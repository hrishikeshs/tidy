import Foundation

enum LearningMinimizationError: LocalizedError {
    case baselineNotReproducible

    var errorDescription: String? {
        switch self {
        case .baselineNotReproducible:
            return "The complete captured state did not reproduce a healthy page in an isolated trial. No policy was saved."
        }
    }
}

struct LearningProgress: Equatable {
    let trial: Int
    let retainedCount: Int
    let attemptedRemovalCount: Int
    let passed: Bool
}

struct LearningMinimizationResult: Equatable {
    let required: [WebStateItem]
    let removable: [WebStateItem]
    let trialCount: Int
}

enum LearningDeltaDebugger {
    @MainActor
    static func minimize(
        items: [WebStateItem],
        evaluate: ([WebStateItem]) async throws -> Bool,
        progress: (LearningProgress) -> Void = { _ in }
    ) async throws -> LearningMinimizationResult {
        let allItems = items.sorted { $0.id < $1.id }
        guard !allItems.isEmpty else {
            return LearningMinimizationResult(required: [], removable: [], trialCount: 0)
        }

        var retained = allItems
        var granularity = min(2, retained.count)
        var trialCount = 1
        let baselinePassed = try await evaluate(retained)
        progress(LearningProgress(
            trial: trialCount,
            retainedCount: retained.count,
            attemptedRemovalCount: 0,
            passed: baselinePassed
        ))
        guard baselinePassed else {
            throw LearningMinimizationError.baselineNotReproducible
        }

        while retained.count >= 2 {
            let chunks = partition(retained, count: granularity)
            var reduced = false

            for chunk in chunks {
                let chunkIDs = Set(chunk.map(\.id))
                let candidate = retained.filter { !chunkIDs.contains($0.id) }
                trialCount += 1
                let passed = try await evaluate(candidate)
                progress(LearningProgress(
                    trial: trialCount,
                    retainedCount: candidate.count,
                    attemptedRemovalCount: chunk.count,
                    passed: passed
                ))
                if passed {
                    retained = candidate
                    granularity = max(2, granularity - 1)
                    reduced = true
                    break
                }
            }

            if !reduced {
                if granularity >= retained.count { break }
                granularity = min(retained.count, granularity * 2)
            }
        }

        if retained.count == 1 {
            trialCount += 1
            let passedWithoutLastItem = try await evaluate([])
            progress(LearningProgress(
                trial: trialCount,
                retainedCount: 0,
                attemptedRemovalCount: 1,
                passed: passedWithoutLastItem
            ))
            if passedWithoutLastItem {
                retained = []
            }
        }

        let requiredIDs = Set(retained.map(\.id))
        return LearningMinimizationResult(
            required: retained,
            removable: allItems.filter { !requiredIDs.contains($0.id) },
            trialCount: trialCount
        )
    }

    private static func partition(_ items: [WebStateItem], count: Int) -> [[WebStateItem]] {
        guard !items.isEmpty else { return [] }
        let partitionCount = max(1, min(count, items.count))
        return (0..<partitionCount).compactMap { index in
            let lower = index * items.count / partitionCount
            let upper = (index + 1) * items.count / partitionCount
            guard lower < upper else { return nil }
            return Array(items[lower..<upper])
        }
    }
}
