export {
  createApiClient,
  type ApiClient,
  type ApiClientOptions,
  type ListTicketsOptions,
  type OverrideRouteInput,
  type RequestMoreInfoInput,
  type TicketListFor,
  type TicketView,
} from "./client";
export {
  ApiClientError,
  type ApiClientErrorCode,
  type ApiClientErrorDetails,
} from "./errors";
export type { FetchLike, RequestInitLike, ResponseLike } from "./http";

// DTOs and schemas are not re-exported. Consumers that need a contract import
// it directly from `@build-manager/api-contracts`.
