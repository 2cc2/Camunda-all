# Depot RabbitMQ Demo

## What this runs

- `ask-for-ctn` from Shipping Agency into RabbitMQ
- RabbitMQ consumer forwards it to Camunda
- Depot workers process the BPMN
- Depot publishes:
  - `empty-ctn-to-transport`
  - `ctn-arrival-info-to-sa`
  - `outbound-ctn-to-ct`
- `outbound-ctn-to-depot` from Transport is also sent through RabbitMQ and forwarded into Camunda

## Install

```bash
npm install
```

## Start RabbitMQ on Windows

1. Start the Windows service in an Administrator terminal:

```bat
net start RabbitMQ
```

2. If the management page is not enabled yet, go to the RabbitMQ `sbin` directory and run:

```bat
rabbitmq-plugins enable rabbitmq_management
```

3. RabbitMQ management UI:

```text
http://localhost:15672
guest / guest
```

## Start Camunda

Use your local Camunda 8 Run instance and make sure these addresses are reachable:

```text
REST:  http://localhost:8080
gRPC:  localhost:26500
```

If your local addresses differ, set:

```bat
set CAMUNDA_REST_ADDRESS=http://localhost:8080
set CAMUNDA_GRPC_ADDRESS=grpc://localhost:26500
set RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

You can quickly check the environment with:

```bat
npm run check:env
```

## Run the full Depot closure

Terminal 1:

```bat
npm run demo -- --orderId=ORDER-20260525-001 --mockInbound=true
```

Terminal 2 if you want manual inbound publishing:

```bat
npm run mock:inbound -- --orderId=ORDER-20260525-001
```

Terminal 2 if you want to simulate the C3 Transport side contract directly:

```bat
npm run mock:c3 -- --orderId=ORDER-20260525-001
```

Terminal 3 if you want to observe outbound queues directly:

```bat
npm run watch:outbound
```

## Run an observed end-to-end demo

```bat
npm run demo:e2e -- --orderId=ORDER-20260525-001 --mockInbound=true
```

This runs the Depot demo and waits for the three outbound queues to receive:

- `empty-ctn-to-transport`
- `ctn-arrival-info-to-sa`
- `outbound-ctn-to-ct`

## Suggested full validation flow

1. Start Camunda 8 Run.
2. Start the Windows RabbitMQ service.
3. Run `npm run check:env`.
4. Run `npm run demo:e2e -- --orderId=ORDER-20260525-001 --mockInbound=true`.
5. Confirm `Observed outbound messages` prints all three downstream events.
6. Run `npm run mock:c3 -- --orderId=ORDER-20260525-001` when you want to validate C3-compatible inbound payloads separately.

## Notes

- `outbound-ctn-to-depot` now accepts both `handOverTime` and C3's `handoverTime`, but Depot emits the normalized `handOverTime`.
- The formal contract uses standard container ids such as `MSKU1234567`.
- `watch:outbound` now uses a temporary exclusive observer queue, so it no longer steals real downstream messages from Transport, Shipping Agency, or Container Terminal.
- Depot inbound consumer now retries failed Camunda forwards up to 3 times and then routes the message to `dlq.camunda`.
