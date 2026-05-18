import { JOB_TYPES, MESSAGE_NAMES, PARTY } from '../source/config'
import { startDepotContractWorkers } from '../source/workers'

type WorkerRegistration = {
  type: string
  jobHandler: (job: any, log: { info: (message: string) => void }) => Promise<unknown>
}

function createFakeJob(initialVariables: Record<string, unknown>) {
  return {
    jobKey: 2251799813700001,
    variables: initialVariables,
    complete: jest.fn(async (payload: Record<string, unknown>) => payload)
  }
}

describe('startDepotContractWorkers', () => {
  test('registers all Depot worker types', () => {
    const registrations: WorkerRegistration[] = []
    const client = {
      createJobWorker: jest.fn((config: WorkerRegistration) => {
        registrations.push(config)
        return { stop: jest.fn() }
      }),
      publishMessage: jest.fn()
    }

    startDepotContractWorkers(client as any)

    expect(registrations.map((r) => r.type)).toEqual([
      JOB_TYPES.sendEmptyCtnToTransport,
      JOB_TYPES.sendCtnArrivalInfoToSa,
      JOB_TYPES.sendOutboundCtnToCt
    ])
  })

  test('send-empty-ctn-to-transport publishes the expected outbound message', async () => {
    const registrations: WorkerRegistration[] = []
    const client = {
      createJobWorker: jest.fn((config: WorkerRegistration) => {
        registrations.push(config)
        return { stop: jest.fn() }
      }),
      publishMessage: jest.fn(async () => ({ messageKey: 'm1' }))
    }

    startDepotContractWorkers(client as any)
    const handler = registrations.find((r) => r.type === JOB_TYPES.sendEmptyCtnToTransport)?.jobHandler
    const job = createFakeJob({
      orderId: 'ORDER-20260507-011',
      senderId: PARTY.shippingAgency.id,
      containerId: 'MSKU1234567',
      vesselId: 'VESSEL-042'
    })

    await handler?.(job, { info: jest.fn() })

    expect(client.publishMessage).toHaveBeenCalledWith(expect.objectContaining({
      name: MESSAGE_NAMES.emptyCtnToTransport,
      correlationKey: 'ORDER-20260507-011',
      timeToLive: 600,
      variables: expect.objectContaining({
        senderId: PARTY.depot.id,
        transportId: PARTY.transport.id,
        containerId: 'MSKU1234567',
        vesselId: 'VESSEL-042'
      })
    }))
    expect(job.complete).toHaveBeenCalledWith({
      containerId: 'MSKU1234567',
      vesselId: 'VESSEL-042',
      emptyCtnSentToTransport: true
    })
  })

  test('send-ctn-arrival-info-to-sa keeps explicit arrival variables', async () => {
    const registrations: WorkerRegistration[] = []
    const client = {
      createJobWorker: jest.fn((config: WorkerRegistration) => {
        registrations.push(config)
        return { stop: jest.fn() }
      }),
      publishMessage: jest.fn(async () => ({ messageKey: 'm2' }))
    }

    startDepotContractWorkers(client as any)
    const handler = registrations.find((r) => r.type === JOB_TYPES.sendCtnArrivalInfoToSa)?.jobHandler
    const job = createFakeJob({
      orderId: 'ORDER-20260507-012',
      senderId: PARTY.shippingAgency.id,
      containerId: 'MSKU1234567',
      vesselId: 'VESSEL-042',
      arrivalTime: '2026-05-07T10:00:00Z',
      terminalLocation: 'Shanghai Waigaoqiao Depot'
    })

    await handler?.(job, { info: jest.fn() })

    expect(client.publishMessage).toHaveBeenCalledWith(expect.objectContaining({
      name: MESSAGE_NAMES.ctnArrivalInfoToSa,
      correlationKey: 'ORDER-20260507-012',
      variables: expect.objectContaining({
        shippingAgencyId: PARTY.shippingAgency.id,
        arrivalTime: '2026-05-07T10:00:00Z',
        terminalLocation: 'Shanghai Waigaoqiao Depot'
      })
    }))
    expect(job.complete).toHaveBeenCalledWith({
      arrivalTime: '2026-05-07T10:00:00Z',
      terminalLocation: 'Shanghai Waigaoqiao Depot',
      ctnArrivalInfoSentToSa: true
    })
  })

  test('send-outbound-ctn-to-ct publishes receipt and completion info', async () => {
    const registrations: WorkerRegistration[] = []
    const client = {
      createJobWorker: jest.fn((config: WorkerRegistration) => {
        registrations.push(config)
        return { stop: jest.fn() }
      }),
      publishMessage: jest.fn(async () => ({ messageKey: 'm3' }))
    }

    startDepotContractWorkers(client as any)
    const handler = registrations.find((r) => r.type === JOB_TYPES.sendOutboundCtnToCt)?.jobHandler
    const job = createFakeJob({
      orderId: 'ORDER-20260507-013',
      senderId: PARTY.transport.id,
      ctnNumber: 'MSKU1234567',
      vesselId: 'VESSEL-042',
      handOverTime: '2026-05-07T11:10:00Z',
      receiptId: 'RECEIPT-20260507-003',
      driverName: 'Zhang San',
      carLicense: 'HU-A-12345',
      loadingCompletedTime: '2026-05-07T11:30:00Z',
      terminalLocation: 'Shanghai Yangshan Terminal'
    })

    await handler?.(job, { info: jest.fn() })

    expect(client.publishMessage).toHaveBeenCalledWith(expect.objectContaining({
      name: MESSAGE_NAMES.outboundCtnToCt,
      correlationKey: 'ORDER-20260507-013',
      variables: expect.objectContaining({
        containerTerminalId: PARTY.containerTerminal.id,
        containerId: 'MSKU1234567',
        receiptId: 'RECEIPT-20260507-003',
        loadingCompletedTime: '2026-05-07T11:30:00Z'
      })
    }))
    expect(job.complete).toHaveBeenCalledWith({
      outboundCtnSentToCt: true,
      loadingCompletedTime: '2026-05-07T11:30:00Z'
    })
  })
})
