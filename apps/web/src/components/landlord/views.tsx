import type {
  BuildingPassportDto,
  LandlordTicketDetailDto,
} from "@build-manager/api-contracts";
import Link from "next/link";
import { contextRows, recommendationState } from "./logic";

/**
 * Pure presentation. These take already-validated public DTOs and render
 * markup; they perform no fetching and hold no state, so every decision they
 * show came from the server.
 */
const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "작성 중",
  PARTIAL: "정보 부족",
  READY_FOR_REVIEW: "검토 대기",
  NEEDS_MORE_INFO: "추가 정보 요청됨",
  SAFETY_ESCALATED: "안전 확인 필요",
  APPROVED: "승인됨",
  OVERRIDDEN: "임대인 지정",
};

const EVIDENCE_LABELS: Record<string, string> = {
  COMPLETE: "필수 정보 확인됨",
  MISSING_REQUIRED: "필수 정보 부족",
  CONFLICTING: "정보 불일치",
  SAFETY_ESCALATED: "안전 위험 신호",
};

const NO_RECOMMENDATION_REASON: Record<string, string> = {
  SAFETY_ESCALATED:
    "안전 위험 신호가 있어 일반 추천을 중단했습니다. 사람이 직접 확인해야 합니다.",
  MISSING_REQUIRED: "필수 정보가 아직 부족해 추천 경로가 없습니다.",
  CONFLICTING: "제출된 정보가 서로 어긋나 추천 경로가 없습니다.",
  AWAITING_INTAKE: "아직 접수가 끝나지 않아 추천 경로가 없습니다.",
};

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <strong>DEMO MODE</strong>
      <p>
        모든 건물·수리 요청 데이터는 합성 데모 데이터입니다. 권한 체계, 실제
        소유 확인, 공공 데이터 연동, 업체 배정은 이 데모에 포함되어 있지
        않습니다.
      </p>
    </div>
  );
}

export function BuildingList({
  buildings,
}: {
  buildings: BuildingPassportDto[];
}) {
  if (buildings.length === 0) {
    return <p className="empty-state">표시할 데모 건물이 없습니다.</p>;
  }

  return (
    <ul className="building-list">
      {buildings.map((building) => (
        <li key={building.buildingId}>
          <Link href={`/demo/landlord/buildings/${building.buildingId}`}>
            {building.displayName}
          </Link>
          <span className="building-use">{building.primaryUse}</span>
        </li>
      ))}
    </ul>
  );
}

export function BuildingPassportPanel({
  passport,
}: {
  passport: BuildingPassportDto;
}) {
  const rows = contextRows(passport);
  const routing = rows.filter((row) => row.routingEligible);
  const informational = rows.filter((row) => !row.routingEligible);

  return (
    <section aria-labelledby="passport-heading" className="passport">
      <h2 id="passport-heading">{passport.displayName}</h2>
      <p className="passport-demo">DEMO 합성 건물 · 실제 주소 없음</p>

      <h3>라우팅 기준 정보</h3>
      <p className="passport-note">
        이 항목만 수리 경로 판단에 사용됩니다. 임대인이 확인한 정보입니다.
      </p>
      <dl className="context-rows">
        {routing.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd>
              {row.value} <span className="provenance">임대인 확인</span>
            </dd>
          </div>
        ))}
      </dl>

      <h3>참고 정보</h3>
      <p className="passport-note">
        아래 항목은 참고용입니다. 값이 바뀌어도 수리 경로는 달라지지 않습니다.
      </p>
      <dl className="context-rows">
        {informational.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd>
              {row.value} <span className="provenance">참고</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function TicketList({
  tickets,
}: {
  tickets: LandlordTicketDetailDto[];
}) {
  if (tickets.length === 0) {
    return (
      <p className="empty-state">
        접수된 수리 요청이 없습니다. 데모를 초기화하면 이 상태로 돌아옵니다.
      </p>
    );
  }

  return (
    <ul className="ticket-list">
      {tickets.map((ticket) => (
        <li key={ticket.ticketId}>
          <Link href={`/demo/landlord/tickets/${ticket.ticketId}`}>
            {ticket.ticketId}
          </Link>
          <span className="ticket-building">{ticket.building.displayName}</span>
          <span className="ticket-status" data-status={ticket.status}>
            {STATUS_LABELS[ticket.status] ?? ticket.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RepairPacketPanel({
  ticket,
}: {
  ticket: LandlordTicketDetailDto;
}) {
  const packet = ticket.repairPacket;
  const state = recommendationState(ticket);
  const recommendation = packet?.recommendation ?? null;

  return (
    <section aria-labelledby="packet-heading" className="repair-packet">
      <h2 id="packet-heading">수리 요청 {ticket.ticketId}</h2>

      <p className="packet-status" data-status={ticket.status}>
        상태: {STATUS_LABELS[ticket.status] ?? ticket.status}
      </p>
      <p className="packet-evidence" data-evidence={ticket.evidenceStatus}>
        정보 상태: {EVIDENCE_LABELS[ticket.evidenceStatus] ?? ticket.evidenceStatus}
      </p>

      {packet === null ? (
        <p className="packet-empty">{NO_RECOMMENDATION_REASON.AWAITING_INTAKE}</p>
      ) : (
        <>
          <p className="packet-revision">검토 문서 개정 {packet.revision}</p>
          <p className="packet-summary">{packet.summary}</p>

          {recommendation === null ? (
            <p className="no-recommendation" data-state={state}>
              추천 경로가 없습니다. {NO_RECOMMENDATION_REASON[state]}
            </p>
          ) : (
            <>
              <h3>추천 경로</h3>
              <p className="recommendation" data-route={recommendation.routeCode}>
                {recommendation.label}
              </p>
              <h3>왜 이 경로인가</h3>
              <ul className="recommendation-reasons">
                {recommendation.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          )}

          <h3>판단 근거가 된 건물 정보</h3>
          {packet.provenance.length === 0 ? (
            <p className="provenance-empty">사용된 라우팅 기준 정보가 없습니다.</p>
          ) : (
            <ul className="packet-provenance">
              {packet.provenance.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <h3>사람의 결정</h3>
      {ticket.decision === null ? (
        <p className="decision-empty">아직 기록된 결정이 없습니다.</p>
      ) : (
        <p className="decision" data-decision={ticket.decision.type}>
          {ticket.decision.type === "APPROVE"
            ? "추천 경로를 승인했습니다."
            : ticket.decision.type === "OVERRIDE"
              ? `임대인이 직접 경로를 지정했습니다: ${ticket.decision.routeCode}`
              : "추가 정보를 요청했습니다."}
        </p>
      )}
    </section>
  );
}

export function StateMessage({
  kind,
  message,
  onRetry,
}: {
  kind: "loading" | "error";
  message?: string;
  onRetry?: () => void;
}) {
  if (kind === "loading") {
    return (
      <p className="state-loading" role="status">
        불러오는 중입니다…
      </p>
    );
  }

  return (
    <div className="state-error" role="alert">
      <p>{message ?? "오류가 발생했습니다."}</p>
      <button type="button" onClick={onRetry}>
        다시 시도
      </button>
    </div>
  );
}
