"use client";

import type {
  BuildingPassportDto,
  HeatingType,
  ManagementMode,
} from "@build-manager/api-contracts";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createBrowserApiClient,
  describeApiError,
} from "@/lib/browser-api-client";
import { BuildingPassportPanel, DemoBanner, StateMessage } from "./views";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; passport: BuildingPassportDto };

const MANAGEMENT_MODES: ReadonlyArray<{ value: ManagementMode; label: string }> =
  [
    { value: "OWNER_DIRECT", label: "임대인 직접 관리" },
    { value: "MANAGEMENT_OFFICE", label: "관리사무소" },
  ];

const HEATING_TYPES: ReadonlyArray<{ value: HeatingType; label: string }> = [
  { value: "INDIVIDUAL", label: "개별난방" },
  { value: "CENTRAL_SHARED", label: "중앙·공용난방" },
];

export function BuildingDetail({ buildingId }: { buildingId: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [managementMode, setManagementMode] =
    useState<ManagementMode>("OWNER_DIRECT");
  const [heatingType, setHeatingType] = useState<HeatingType>("INDIVIDUAL");
  const [ownerSuppliedBoiler, setOwnerSuppliedBoiler] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const passport = await createBrowserApiClient().getBuilding(buildingId);
      setState({ kind: "ready", passport });
      setManagementMode(passport.managementMode);
      setHeatingType(passport.heatingType);
      setOwnerSuppliedBoiler(passport.ownerSuppliedBoiler ?? false);
    } catch (error) {
      setState({ kind: "error", message: describeApiError(error) });
    }
  }, [buildingId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Renders the validated server response, never an optimistic local guess. */
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const passport = await createBrowserApiClient().verifyBuildingContext(
        buildingId,
        { managementMode, heatingType, ownerSuppliedBoiler },
      );
      setState({ kind: "ready", passport });
      setSaved(true);
    } catch (error) {
      setSaveError(describeApiError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="landlord-page">
      <DemoBanner />
      <p>
        <Link href="/demo/landlord">← 임대인 데모 홈</Link>
      </p>

      {state.kind === "loading" ? <StateMessage kind="loading" /> : null}

      {state.kind === "error" ? (
        <StateMessage
          kind="error"
          message={state.message}
          onRetry={() => void load()}
        />
      ) : null}

      {state.kind === "ready" ? (
        <>
          <BuildingPassportPanel passport={state.passport} />

          <section aria-labelledby="verify-heading" className="verify-context">
            <h3 id="verify-heading">임대인 정보 확인</h3>
            <p className="passport-note">
              여기서 확인한 항목만 수리 경로 판단에 사용됩니다.
            </p>

            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="managementMode">관리 방식</label>
                <select
                  id="managementMode"
                  name="managementMode"
                  value={managementMode}
                  onChange={(event) =>
                    setManagementMode(event.target.value as ManagementMode)
                  }
                >
                  {MANAGEMENT_MODES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="heatingType">난방 방식</label>
                <select
                  id="heatingType"
                  name="heatingType"
                  value={heatingType}
                  onChange={(event) =>
                    setHeatingType(event.target.value as HeatingType)
                  }
                >
                  {HEATING_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field field-check">
                <input
                  id="ownerSuppliedBoiler"
                  name="ownerSuppliedBoiler"
                  type="checkbox"
                  checked={ownerSuppliedBoiler}
                  onChange={(event) =>
                    setOwnerSuppliedBoiler(event.target.checked)
                  }
                />
                <label htmlFor="ownerSuppliedBoiler">임대인이 공급한 보일러</label>
              </div>

              <button type="submit" disabled={saving}>
                {saving ? "저장 중…" : "확인 정보 저장"}
              </button>
            </form>

            {saveError === null ? null : (
              <p className="state-error" role="alert">
                {saveError}
              </p>
            )}
            {saved ? (
              <p className="save-ok" role="status" data-testid="verify-saved">
                확인 정보를 저장했습니다.
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
