export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type InspectionMode = 'DOCUMENTARY' | 'PHYSICAL'
export type ReviewStatus = 'AUTO_RELEASE' | 'MANUAL_REVIEW'
export type ManifestTimingStatus = 'ON_TIME' | 'LATE' | 'UNKNOWN'
export type ConsistencyStatus = 'CONSISTENT' | 'INCONSISTENT'

type DecisionInput = {
    orderId?: string
    hsCode?: string
    declaredValue?: number
    quantity?: number
    countryOfDestination?: string
    cargoDescription?: string
    vesselId?: string
    containerId?: string
    manifestId?: string
    manifestVesselId?: string
    manifestContainerId?: string
    manifestCargoDescription?: string
    manifestQuantity?: number
    manifestFiledAt?: string
    arrivalTime?: string
}

export type CustomsDecision = {
    riskScore: number
    riskLevel: RiskLevel
    riskFlags: string[]
    consistencyStatus: ConsistencyStatus
    consistencyIssues: string[]
    manifestTimingStatus: ManifestTimingStatus
    reviewStatus: ReviewStatus
    recommendedInspectionType: InspectionMode
    clearanceBasis: string
}

export function evaluateDeclarationPrecheck(input: DecisionInput): CustomsDecision {
    return buildDecision(input, false)
}

export function evaluateSupervisionDecision(input: DecisionInput): CustomsDecision {
    return buildDecision(input, true)
}

function buildDecision(input: DecisionInput, withMultiSourceChecks: boolean): CustomsDecision {
    let riskScore = 0
    const riskFlags: string[] = []
    const consistencyIssues: string[] = []

    if ((input.declaredValue ?? 0) >= 50000) {
        riskScore += 25
        riskFlags.push('HIGH_DECLARED_VALUE')
    } else if ((input.declaredValue ?? 0) >= 20000) {
        riskScore += 15
        riskFlags.push('ELEVATED_DECLARED_VALUE')
    }

    if ((input.quantity ?? 0) >= 500) {
        riskScore += 10
        riskFlags.push('LARGE_QUANTITY')
    } else if ((input.quantity ?? 0) >= 200) {
        riskScore += 5
        riskFlags.push('MEDIUM_QUANTITY')
    }

    if ((input.hsCode ?? '').startsWith('95')) {
        riskScore += 10
        riskFlags.push('TOY_CATEGORY_MONITORING')
    }

    if ((input.countryOfDestination ?? '').toUpperCase() === 'US') {
        riskScore += 5
        riskFlags.push('US_DESTINATION_CONTROL')
    }

    if (isRandomInspectionCandidate(input.orderId)) {
        riskScore += 8
        riskFlags.push('RANDOM_INSPECTION_TRIGGER')
    }

    let manifestTimingStatus: ManifestTimingStatus = 'UNKNOWN'

    if (withMultiSourceChecks) {
        if (input.manifestVesselId && input.vesselId && input.manifestVesselId !== input.vesselId) {
            consistencyIssues.push('VESSEL_ID_MISMATCH')
            riskScore += 35
        }

        if (input.manifestContainerId && input.containerId && input.manifestContainerId !== input.containerId) {
            consistencyIssues.push('CONTAINER_ID_MISMATCH')
            riskScore += 35
        }

        if (
            input.manifestCargoDescription &&
            input.cargoDescription &&
            !isSameCargo(input.manifestCargoDescription, input.cargoDescription)
        ) {
            consistencyIssues.push('CARGO_DESCRIPTION_MISMATCH')
            riskScore += 25
        }

        if (
            typeof input.manifestQuantity === 'number' &&
            typeof input.quantity === 'number' &&
            input.manifestQuantity !== input.quantity
        ) {
            consistencyIssues.push('QUANTITY_MISMATCH')
            riskScore += 15
        }

        manifestTimingStatus = evaluateManifestTiming(input.manifestFiledAt, input.arrivalTime)
        if (manifestTimingStatus === 'LATE') {
            consistencyIssues.push('MANIFEST_FILED_AFTER_ARRIVAL')
            riskScore += 20
        }
    }

    const consistencyStatus = consistencyIssues.length === 0 ? 'CONSISTENT' : 'INCONSISTENT'
    const reviewStatus = consistencyIssues.length === 0 ? 'AUTO_RELEASE' : 'MANUAL_REVIEW'
    const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW'
    const recommendedInspectionType =
        reviewStatus === 'MANUAL_REVIEW' || riskLevel === 'HIGH' ? 'PHYSICAL' : 'DOCUMENTARY'

    const clearanceBasis = buildClearanceBasis({
        consistencyStatus,
        manifestTimingStatus,
        riskLevel,
        reviewStatus,
    })

    return {
        riskScore,
        riskLevel,
        riskFlags,
        consistencyStatus,
        consistencyIssues,
        manifestTimingStatus,
        reviewStatus,
        recommendedInspectionType,
        clearanceBasis,
    }
}

function evaluateManifestTiming(manifestFiledAt?: string, arrivalTime?: string): ManifestTimingStatus {
    if (!manifestFiledAt || !arrivalTime) {
        return 'UNKNOWN'
    }

    const manifestAt = Date.parse(manifestFiledAt)
    const arrivalAt = Date.parse(arrivalTime)
    if (Number.isNaN(manifestAt) || Number.isNaN(arrivalAt)) {
        return 'UNKNOWN'
    }

    return manifestAt <= arrivalAt ? 'ON_TIME' : 'LATE'
}

function buildClearanceBasis(input: {
    consistencyStatus: ConsistencyStatus
    manifestTimingStatus: ManifestTimingStatus
    riskLevel: RiskLevel
    reviewStatus: ReviewStatus
}) {
    const parts = [
        `consistency=${input.consistencyStatus}`,
        `manifestTiming=${input.manifestTimingStatus}`,
        `riskLevel=${input.riskLevel}`,
        `review=${input.reviewStatus}`,
    ]
    return parts.join('; ')
}

function normalizeText(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function isSameCargo(left: string, right: string) {
    return normalizeText(left) === normalizeText(right)
}

function isRandomInspectionCandidate(orderId?: string) {
    if (!orderId) return false
    const lastChar = orderId.at(-1)
    return lastChar === '1' || lastChar === '7'
}
