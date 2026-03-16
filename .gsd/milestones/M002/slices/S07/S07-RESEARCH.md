# M002/S07 End-to-End Hosted Launch Proof — Research

**Date:** 2026-03-15

## Summary

S07 owns the final hosted proof for **R011** and directly supports **R001, R002, R003, R004, R005, R006, R007, and R010**. The repo already has the important subsystems proven separately: S05 established the hosted browser-vs-machine access contract and a localhost hosted-mode harness, S04 established the unattended refresh-first daily sweep with durable evidence, and S06 established the deploy/runtime artifact set for Proxmox. What is still missing is not more architecture. It is one truthful, operator-readable proof that these pieces work together in the live topology.

The existing code strongly constrains how that proof must be done. Friend-facing access must be browser traffic through Cloudflare Access, not bearer-token calls to the public hostname. Runtime data must stay under `/srv/transcript-library`, outside the release tree under `/opt/transcript-library/current`. Unattended automation must remain the daily sweep and therefore remain refresh-only plus conservative repair — not auto-analysis. Hosted analysis itself depends on the Linux user running pm2 also having the provider binary and auth state available.

The main gap is orchestration and evidence capture. There is no S07 proof harness yet that ties together deploy manifest, hosted preflight, Cloudflare-gated browser access, refresh evidence, daily sweep evidence, pm2/systemd state, and a real hosted analysis run writing `analysis.json`, `analysis.md`, `run.json`, `status.json`, and logs under persistent storage. S07 should focus on composing those existing proofs, not inventing new runtime paths.

## Recommendation

Build S07 around **one hosted-launch verification flow** that reuses the existing authorities instead of introducing new ones:

1. **Deploy on the real Proxmox host using the existing `deploy/` toolkit** and capture `deploy-manifest.json`, `readlink /opt/transcript-library/current`, `pm2 show transcript-library`, and `journalctl` output for the deploy-hook and sweep services.
2. **Verify hosted preflight on the real host** before any user flow: the app must start with `HOSTED=true`, the transcript repo must be a real git checkout, and the refresh evidence files must exist where hosted mode expects them.
3. **Exercise the live access split exactly as designed**:
   - friend-facing hostname: real Cloudflare Access browser flow
   - machine-only automation: same-host systemd sweep and/or dedicated machine endpoint
4. **Prove refresh + repair through the daily sweep**, then inspect `last-source-refresh.json`, `last-import-validation.json`, and `runtime/daily-operational-sweep/latest.json` under `/srv/transcript-library`.
5. **Prove real hosted analysis** by triggering `/api/analyze` for one known video from the hosted app, then waiting for durable artifact completion under `/srv/transcript-library/insights/<videoId>/`.
6. **Record one manual/UAT browser step** for the real Cloudflare OTP flow. The current harness tools here are local-browser oriented, so S07 should treat the real external Access login as explicit human verification paired with machine-collected server evidence.

The most likely implementation shape is a new S07 verification script plus a short operator runbook. The script should gather machine-verifiable evidence from the host and from durable runtime files; the runbook should cover the one piece that cannot be truthfully inferred from localhost header injection: the actual friend-facing Cloudflare Access browser experience.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Hosted browser-vs-machine auth proof | `scripts/verify-s05-hosted-access.sh` | Already proves the route contract and the `/api/sync-hook` machine-boundary sentinel. S07 should extend or adapt it for the live host instead of inventing a second auth harness. |
| Unattended refresh/repair proof | `scripts/daily-operational-sweep.ts` + `src/lib/daily-operational-sweep.ts` | This is already the supported unattended authority and writes durable latest/archive JSON evidence. Any S07 proof should inspect these artifacts, not schedule a custom cron command. |
| Deploy/runtime layout | `deploy/deploy.sh`, `deploy/rollback.sh`, `deploy/ecosystem.config.cjs`, `deploy/systemd/*.service`, `deploy/cloudflared-config.yml` | S06 already established the `/opt` + `/srv` release pattern. S07 should prove that layout live, not replace it with ad hoc server commands. |
| Hosted analysis lifecycle evidence | `src/lib/analysis.ts`, `/api/analyze`, `/api/insight`, `/api/insight/stream` | The runtime already writes `run.json`, `status.json`, attempt artifacts, and curated log surfaces. S07 should reuse these durable artifacts as proof. |

## Existing Code and Patterns

- `src/lib/hosted-config.ts` — Hosted preflight is the runtime authority for startup validation. It already encodes the hard requirements S07 must satisfy live: absolute-path transcript repo, git checkout, `PRIVATE_API_TOKEN`, `CLOUDFLARE_ACCESS_AUD`, and refresh-evidence visibility.
- `src/lib/private-api-guard.ts` — The hosted trust boundary is already split into Cloudflare-browser callers and bearer-authenticated machine callers. S07 should preserve this split exactly; bearer auth on the friend-facing hostname is the wrong proof.
- `scripts/verify-s05-hosted-access.sh` — Best starting point for S07 access proof. It exercises `/api/insight`, `/api/analyze`, `/api/insight/stream`, anonymous rejection, and `/api/sync-hook` rejection for browser-only callers.
- `src/lib/analysis.ts` — Hosted analysis still depends on a local CLI provider (`claude` or `codex`) available to the running process user. Spawn failures, timeout failures, structured-output failures, and successful completions all land in durable run artifacts.
- `src/lib/daily-operational-sweep.ts` and `scripts/daily-operational-sweep.ts` — The unattended contract is refresh first, conservative repair second, durable evidence always. S07 should inspect the generated JSON records rather than only checking command exit codes.
- `deploy/deploy.sh` — Release deploys already assume immutable release directories under `/opt/transcript-library/releases`, atomic symlink swap to `/opt/transcript-library/current`, and pm2 restart. S07 should verify those paths live instead of drifting into `git pull`-style mutations.
- `deploy/systemd/transcript-library-sweep.service` and `deploy/systemd/deploy-hook.service` — These define the real unattended/runtime execution paths. They are critical to S07 because both invoke `node --import tsx`, which introduces a host-level dependency outside app preflight.
- `docs/operations/source-repo-sync-contract.md` — This is the clearest statement of the launch-time contract: refresh is refresh-only, browser traffic is Cloudflare-managed, machine access is explicit, and deploy automation should stay on a dedicated hostname.

## Constraints

- S07 must validate the **live topology**, not just rerun localhost harnesses. S05 and S06 already proved internal logic and artifact consistency; S07 is where those assumptions meet the real host.
- The friend-facing hostname is **browser-only** in intent. `/api/analyze`, `/api/insight`, and `/api/insight/stream` are supposed to succeed through Cloudflare Access identity, while `/api/sync-hook` remains a machine entrypoint.
- Runtime data must remain outside the release tree: catalog, insights, logs, runtime sweep records, and the transcript checkout all belong under `/srv/transcript-library`.
- The unattended default must stay `node --import tsx scripts/daily-operational-sweep.ts`. New videos becoming browsable is in-scope; auto-analysis of newly synced videos is explicitly out of scope.
- Hosted analysis requires the same Linux user running pm2/systemd jobs to have the provider binary (`claude` or `codex`) on PATH and to have valid auth state/credits.
- The systemd units and helper scripts currently rely on `tsx`; `tsx` exists as a repo devDependency, but S06 already noted that the host bootstrap script does not install it globally.
- Browser automation tools in this harness are intended for local apps, so the real Cloudflare Access OTP flow needs explicit human/UAT coverage or a separately approved approach.

## Common Pitfalls

- **Proving the wrong auth path** — Hitting the friend-facing hostname with a bearer token only proves a machine path, not the actual launch experience. Use real Cloudflare browser identity for the friend-facing proof and keep bearer/service-token traffic on machine-only paths.
- **Calling the sweep successful because the command exited 0** — S07 needs the durable artifacts too: `last-source-refresh.json`, `last-import-validation.json`, and `runtime/daily-operational-sweep/latest.json`, especially `manualFollowUpVideoIds`.
- **Testing analysis under the wrong Linux user** — A manual shell may have `claude` login and PATH configured while pm2/systemd does not. S07 needs proof from the same runtime user that owns the hosted process.
- **Mutating runtime state inside the release tree** — Any proof that writes under `/opt/transcript-library/current/data/...` instead of `/srv/transcript-library/...` invalidates the release-layout contract.
- **Assuming localhost header injection equals real Access** — `scripts/verify-s05-hosted-access.sh` is valuable, but it is a synthetic proof of request shape. S07 still needs a real Cloudflare-gated browser confirmation.
- **Missing `tsx` on the host** — `deploy-hook.service` and `transcript-library-sweep.service` both invoke `node --import tsx ...`; if `tsx` is unavailable to that runtime, unattended proof will fail before app logic starts.

## Open Risks

- Real hosted analysis may still fail for non-code reasons: expired Claude login, insufficient provider credits, missing binary on PATH, or different environment under pm2/systemd than in an interactive shell.
- The current Cloudflare browser trust check validates payload audience but does not perform full JWKS signature verification. That is acceptable for the current trust model, but it remains a security boundary assumption S07 should document rather than silently strengthen by implication.
- The deploy hook depends on `DEPLOY_WEBHOOK_SECRET` and repo clone access, but those are not enforced by app preflight. S07 could pass app startup while deploy automation is still broken.
- There is no integrated S07 harness yet. Without one, the slice can drift into screenshots, shell history, and one-off manual checks that are hard to trust later.
- If Cloudflare Access blocks or complicates machine-origin verification, S07 may need to separate “friend browser proof” from “machine ingress proof” rather than forcing both through one hostname.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| Cloudflare Tunnel / Access | `vm0-ai/vm0-skills@cloudflare-tunnel` | available — install with `npx skills add vm0-ai/vm0-skills@cloudflare-tunnel` |
| Cloudflare Zero Trust | `bagelhole/devops-security-agent-skills@cloudflare-zero-trust` | available — install with `npx skills add bagelhole/devops-security-agent-skills@cloudflare-zero-trust` |
| Proxmox | `basher83/lunar-claude@proxmox-infrastructure` | available — install with `npx skills add basher83/lunar-claude@proxmox-infrastructure` |
| PM2 | `marcfargas/skills@pm2` | available — install with `npx skills add marcfargas/skills@pm2` |
| systemd | `chaterm/terminal-skills@systemd` | available — install with `npx skills add chaterm/terminal-skills@systemd` |
| Next.js deployment | `giuseppe-trisciuoglio/developer-kit@nextjs-deployment` | available — install with `npx skills add giuseppe-trisciuoglio/developer-kit@nextjs-deployment` |

## Sources

- S07’s requirement footprint is final-proof work, not new subsystem work: it owns R011 and supports the launch/access/deploy/reliability requirements already mapped by earlier slices. (source: [M002 roadmap](../../M002-ROADMAP.md))
- The unattended proof surface already exists: one daily sweep can refresh source state, repair only the safe class, preserve rerun-only honesty, and leave durable JSON evidence. (source: [S04 summary](../S04/S04-SUMMARY.md))
- The hosted access contract is already split cleanly between Cloudflare-browser callers and machine callers, and a local hosted-mode harness already exercises the route set S07 cares about. (source: [S05 summary](../S05/S05-SUMMARY.md))
- The Proxmox deployment toolkit is already laid out under `deploy/`, but S06 only verified internal consistency; live-runtime proof was explicitly deferred to S07. (source: [S06 summary](../S06/S06-SUMMARY.md))
- Hosted startup currently enforces the real environment assumptions S07 must satisfy: absolute transcript repo path, git checkout, `PRIVATE_API_TOKEN`, `CLOUDFLARE_ACCESS_AUD`, and refresh evidence visibility. (source: [src/lib/hosted-config.ts](../../../../../src/lib/hosted-config.ts))
- The trusted hosted caller split is implemented in one place, and browser trust is based on Cloudflare headers plus audience, while machine trust stays bearer-based. (source: [src/lib/private-api-guard.ts](../../../../../src/lib/private-api-guard.ts))
- The existing hosted access harness already covers `/api/insight`, `/api/analyze`, `/api/insight/stream`, anonymous rejection, and browser rejection on `/api/sync-hook`; S07 can extend it instead of starting over. (source: [scripts/verify-s05-hosted-access.sh](../../../../../scripts/verify-s05-hosted-access.sh))
- Hosted analysis still runs through local CLI providers and writes durable run/state artifacts, so S07 must verify the provider binary and auth state under the real runtime user. (source: [src/lib/analysis.ts](../../../../../src/lib/analysis.ts))
- The supported hosted source-sync contract is still refresh-only, and the daily sweep remains the unattended default instead of auto-analysis. (source: [source repo sync contract](../../../../../docs/operations/source-repo-sync-contract.md))
- The current deploy model matches standard Next.js production scripts (`next build` + `next start`); standalone output is optional, not required for this slice. (source: [Next.js deploying docs](https://github.com/vercel/next.js/blob/canary/docs/01-app/01-getting-started/17-deploying.mdx))
