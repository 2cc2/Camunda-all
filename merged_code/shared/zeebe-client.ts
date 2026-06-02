import * as dotenv from 'dotenv';
import { Camunda8 } from '@camunda8/sdk';

dotenv.config();

function normalizeRestAddress(rawAddress: string): string {
  const trimmed = rawAddress.trim().replace(/\/+$/, '');
  // SDK 会自动拼接 /v2，这里容错移除用户可能填写的 /v2
  return trimmed.replace(/\/v2$/i, '');
}

const ZEEBE_REST_ADDRESS = normalizeRestAddress(
  process.env.ZEEBE_REST_ADDRESS ?? 'http://localhost:8088'
);
const ZEEBE_GRPC_ADDRESS =
  process.env.ZEEBE_ADDRESS ?? 'localhost:26500';

/**
 * 统一的 CamundaRestClient 工厂。所有 worker / script 都通过本函数取 client，
 * 保证连接参数（地址、auth、SSL）集中可改。
 */
export function makeClient() {
  // gRPC 用 grpc:// 前缀表示明文连接（替代已废弃的 ZEEBE_INSECURE_CONNECTION）
  const grpcAddress = ZEEBE_GRPC_ADDRESS.startsWith('grpc')
    ? ZEEBE_GRPC_ADDRESS
    : `grpc://${ZEEBE_GRPC_ADDRESS}`;

  const c8 = new Camunda8({
    CAMUNDA_AUTH_STRATEGY: 'NONE',
    ZEEBE_REST_ADDRESS,
    ZEEBE_GRPC_ADDRESS: grpcAddress,
    CAMUNDA_OAUTH_DISABLED: true,
  });
  return c8.getCamundaRestClient();
}

export function getConnectionInfo() {
  return { ZEEBE_REST_ADDRESS, ZEEBE_GRPC_ADDRESS };
}
