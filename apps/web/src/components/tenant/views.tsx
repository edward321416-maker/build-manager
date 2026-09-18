import type {
  BuildingPassportDto,
  SyntheticEvidenceRequirementDto,
  TenantMoreInfoRequestDto,
  TenantQuestionDto,
  TenantTicketStatusDto,
} from "@build-manager/api-contracts";

/**
 * Pure tenant presentation. These take already-validated tenant DTOs, so no
 * landlord-only field can reach them — there is nothing to filter out here
 * because nothing landlord-only is ever passed in.
 */
const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "작성 중",
  PARTIAL: "정보 부족",
  READY_FOR_REVIEW: "검토 대기",
  NEEDS_MORE_INFO: "추가 정보 요청됨",
  SAFETY_ESCALATED: "안전 확인 필요",
  APPROVED: "임대인 확인 완료",
  OVERRIDDEN: "임대인 확인 완료",
};

const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  COMPLETE: "필수 정보 확인됨",
  MISSING_REQUIRED: "필수 정보 부족",
  CONFLICTING: "정보가 서로 어긋남",
  SAFETY_ESCALATED: "안전 위험 신호",
};

export function TenantDemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <strong>DEMO MODE</strong>
      <p>
        모든 건물·수리 요청 데이터는 합성 데모 데이터입니다. 임차인 본인 확인,
        권한 체계, 실제 공공 데이터 연동, 업체 배정은 이 데모에 포함되어 있지
        않습니다.
      </p>
    </div>
  );
}

export function TenantBuildingChoices({
  buildings,
  selected,
}: {
  buildings: BuildingPassportDto[];
  selected: string | null;
}) {
  if (buildings.length === 0) {
    return <p className="empty-state">표시할 데모 건물이 없습니다.</p>;
  }

  return (
    <fieldset className="building-choices">
      <legend>어느 건물인가요?</legend>
      {buildings.map((building) => (
        <div className="field-check" key={building.buildingId}>
          <input
            type="radio"
            id={`building-${building.buildingId}`}
            name="buildingId"
            value={building.buildingId}
            defaultChecked={selected === building.buildingId}
          />
          <label htmlFor={`building-${building.buildingId}`}>
            {building.displayName}
            <span className="building-use"> · {building.primaryUse}</span>
          </label>
        </div>
      ))}
    </fieldset>
  );
}

export function QuestionCard({
  question,
  children,
}: {
  question: TenantQuestionDto;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="question-heading" className="question-card">
      <h2 id="question-heading">{question.prompt}</h2>

      {question.responseType === "YES_NO" ? (
        <div className="question-choices">
          <button type="submit" name="answer" value="yes" data-testid="answer-yes">
            예
          </button>
          <button type="submit" name="answer" value="no" data-testid="answer-no">
            아니오
          </button>
        </div>
      ) : null}

      {question.responseType === "TEXT" ? (
        <div className="field">
          <label htmlFor="answer-text">답변</label>
          <input id="answer-text" name="answer" type="text" />
          <button type="submit" data-testid="answer-text-submit">
            답변 제출
          </button>
        </div>
      ) : null}

      {question.responseType === "SINGLE_SELECT" ? (
        <div className="question-choices">
          {question.options.map((option) => (
            <button
              key={option.value}
              type="submit"
              name="answer"
              value={option.value}
              data-testid={`answer-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {children}
    </section>
  );
}

export function SafetyNotice() {
  return (
    <section aria-labelledby="safety-heading" className="safety-notice" role="alert">
      <h2 id="safety-heading">안전 확인이 필요합니다</h2>
      <p>
        신고 내용에서 안전 위험 신호가 확인되어 일반 진단 절차를 중단했습니다.
      </p>
      <p>
        이 데모는 안전을 판정하지 않으며, 사람이 직접 상황을 확인해야 합니다.
        임대인·관리 주체에게 상황이 전달되도록 접수 상태가 표시됩니다.
      </p>
    </section>
  );
}

export function EvidenceStage({
  requirements,
  submitted,
}: {
  requirements: SyntheticEvidenceRequirementDto[];
  submitted: TenantTicketStatusDto["submittedEvidence"];
}) {
  return (
    <section aria-labelledby="evidence-heading" className="evidence-stage">
      <h2 id="evidence-heading">DEMO 증빙</h2>
      <p className="passport-note">
        이 데모는 실제 사진을 올리지 않습니다. 준비된 합성 예시를 선택해 제출합니다.
      </p>

      {requirements.length === 0 ? (
        <p className="empty-state">제출할 DEMO 증빙이 남아 있지 않습니다.</p>
      ) : (
        <ul className="evidence-list">
          {requirements.map((requirement) => (
            <li key={requirement.evidenceType}>
              <span>{requirement.label}</span>
              <button
                type="submit"
                name="demoFixtureId"
                value={requirement.demoFixtureId}
                data-testid={`submit-${requirement.evidenceType}`}
              >
                DEMO 증빙 제출
              </button>
            </li>
          ))}
        </ul>
      )}

      {submitted.length === 0 ? null : (
        <>
          <h3>제출한 DEMO 증빙</h3>
          <ul className="evidence-submitted">
            {submitted.map((item) => (
              <li key={item.evidenceId}>{item.label}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function FollowUpPanel({
  request,
  children,
}: {
  request: TenantMoreInfoRequestDto;
  children?: React.ReactNode;
}) {
  const fulfilled =
    request.requestedQuestions.length === 0 &&
    request.requestedEvidence.length === 0;

  return (
    <section aria-labelledby="follow-up-heading" className="follow-up-panel">
      <h2 id="follow-up-heading">임대인이 추가 정보를 요청했습니다</h2>
      <p className="follow-up-reason">{request.reason}</p>

      {fulfilled ? (
        <p className="follow-up-done" data-testid="follow-up-done">
          추가정보가 반영되었습니다. 다시 제출해 주세요.
        </p>
      ) : (
        <>
          {request.requestedQuestions.length === 0 ? null : (
            <>
              <h3>다시 답할 질문</h3>
              <ul className="follow-up-questions">
                {request.requestedQuestions.map((question) => (
                  <li key={question.questionId}>{question.prompt}</li>
                ))}
              </ul>
            </>
          )}

          {request.requestedEvidence.length === 0 ? null : (
            <>
              <h3>다시 제출할 DEMO 증빙</h3>
              <ul className="follow-up-evidence">
                {request.requestedEvidence.map((requirement) => (
                  <li key={requirement.evidenceType}>{requirement.label}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {children}
    </section>
  );
}

export function TenantStatusPanel({
  ticket,
}: {
  ticket: TenantTicketStatusDto;
}) {
  return (
    <section aria-labelledby="tenant-status-heading" className="tenant-status">
      <h2 id="tenant-status-heading">접수 상태</h2>

      <p className="packet-status" data-status={ticket.status}>
        상태: {STATUS_LABELS[ticket.status] ?? ticket.status}
      </p>
      <p className="packet-evidence" data-evidence={ticket.evidenceStatus}>
        정보 상태:{" "}
        {EVIDENCE_STATUS_LABELS[ticket.evidenceStatus] ?? ticket.evidenceStatus}
      </p>

      {ticket.packet === null ? (
        <p className="packet-empty">아직 제출이 완료되지 않았습니다.</p>
      ) : (
        <>
          <p className="packet-revision">제출 회차 {ticket.packet.revision}</p>
          <p className="packet-summary">{ticket.packet.summary}</p>
        </>
      )}
    </section>
  );
}
