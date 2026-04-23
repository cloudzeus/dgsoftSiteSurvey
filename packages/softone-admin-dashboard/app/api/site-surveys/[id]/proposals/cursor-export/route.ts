import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { bunnyUpload } from "@/lib/bunny"

type Params = { params: Promise<{ id: string }> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callDeepSeek(apiKey: string, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: maxTokens,
      temperature: 0.6,
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek: ${await res.text()}`)
  const data = await res.json() as { choices: { message: { content: string } }[] }
  return data.choices?.[0]?.message?.content?.trim() ?? ""
}

function stripHtml(html: string): string {
  return html
    .replace(/<\/p>/gi, "\n")
    .replace(/<p>/gi, "")
    .replace(/<strong>/gi, "**")
    .replace(/<\/strong>/gi, "**")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// ─── POST /api/site-surveys/:id/proposals/cursor-export ──────────────────────
// Generates CLAUDE.md and SPECIFICATIONS.md for AI-assisted development.
// Should be triggered after proposal status = ACCEPTED.

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const surveyId = parseInt(id, 10)
    if (isNaN(surveyId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })

    // ── 1. Load proposal + survey + requirements ───────────────────────────

    const proposals = await db.$queryRaw<{
      id: number; title: string; description: string | null; status: string
    }[]>`
      SELECT id, title, description, status FROM SurveyProposal WHERE surveyId = ${surveyId} LIMIT 1
    `
    if (!proposals.length) return NextResponse.json({ error: "No proposal found" }, { status: 404 })
    const proposal = proposals[0]

    const surveys = await db.$queryRaw<{
      id: number; name: string; customerId: number;
    }[]>`SELECT id, name, customerId FROM SiteSurvey WHERE id = ${surveyId} LIMIT 1`
    if (!surveys.length) return NextResponse.json({ error: "Survey not found" }, { status: 404 })
    const survey = surveys[0]

    const customer = await db.customer.findUnique({
      where: { id: survey.customerId },
      select: { name: true, afm: true, jobtypetrd: true, city: true },
    })

    const requirements = await db.$queryRaw<{
      id: number; section: string; source: string; title: string; description: string | null
    }[]>`
      SELECT id, section, source, title, description
      FROM ClientRequirement WHERE surveyId = ${surveyId}
      ORDER BY FIELD(section,'HARDWARE_NETWORK','SOFTWARE','WEB_ECOMMERCE','COMPLIANCE','IOT_AI'), source, id
    `

    const sectionLabels: Record<string, string> = {
      HARDWARE_NETWORK: "Infrastructure & Networking",
      SOFTWARE:         "Business Software",
      WEB_ECOMMERCE:    "Web & E-commerce",
      COMPLIANCE:       "Compliance & Security",
      IOT_AI:           "IoT & AI",
    }

    // Group requirements by section
    const reqsBySection: Record<string, typeof requirements> = {}
    for (const r of requirements) {
      if (!reqsBySection[r.section]) reqsBySection[r.section] = []
      reqsBySection[r.section].push(r)
    }

    // ── 2. Load DeepSeek credentials ──────────────────────────────────────

    const conn = await db.connection.findFirst({
      where: { type: "DEEPSEEK", isActive: true },
      select: { credentials: true },
    })
    if (!conn) return NextResponse.json({ error: "No active DeepSeek connection" }, { status: 503 })
    const apiKey = (conn.credentials as Record<string, string>).apiKey

    const customerName = customer?.name ?? `Customer #${survey.customerId}`
    const proposalText = proposal.description ? stripHtml(proposal.description) : ""
    const projectName  = proposal.title.replace(/^Τεχνική Πρόταση — /i, "").replace(/\s*—\s*\d+.*$/, "").trim()

    // Build requirements summary for context
    const reqContext = Object.entries(reqsBySection).map(([section, reqs]) => {
      const label = sectionLabels[section] ?? section
      const customerReqs = reqs.filter(r => r.source !== "COMPANY")
      const companyReqs  = reqs.filter(r => r.source === "COMPANY")
      const lines: string[] = [`### ${label}`]
      if (customerReqs.length) {
        lines.push("Client requirements:")
        customerReqs.forEach((r, i) => lines.push(`${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`))
      }
      if (companyReqs.length) {
        lines.push("Our technical recommendations:")
        companyReqs.forEach((r, i) => lines.push(`${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`))
      }
      return lines.join("\n")
    }).join("\n\n")

    const AI_SYSTEM = `You are a senior software architect writing project specification files for AI-assisted development with Claude Code and Cursor. Your output is used directly by developers — it must be precise, actionable, and complete. Write in English. Use standard Markdown. Be specific about technologies, patterns, and architecture decisions. Never add filler content.`

    // ── 3. Generate CLAUDE.md ──────────────────────────────────────────────

    const claudeMdPrompt = [
      `Project: ${projectName}`,
      `Client: ${customerName} (${customer?.jobtypetrd ?? "Business"})`,
      ``,
      `Accepted proposal content (Greek, summarise into English):`,
      proposalText.slice(0, 4000),
      ``,
      `Requirements by section:`,
      reqContext,
      ``,
      `Generate a CLAUDE.md file for this project. This file will be placed in the project root and read by Claude Code / Cursor at the start of every session.`,
      ``,
      `Structure:`,
      `# [Project Name]`,
      ``,
      `## Project Overview`,
      `[2-3 sentences describing what's being built and why]`,
      ``,
      `## Client`,
      `[Company name, industry, location]`,
      ``,
      `## Tech Stack`,
      `[Recommended stack based on project requirements — be specific with versions]`,
      `- Frontend: `,
      `- Backend: `,
      `- Database: `,
      `- Authentication: `,
      `- Infrastructure: `,
      `- AI tooling: Claude Code (Anthropic)`,
      ``,
      `## Project Modules`,
      `[List of main modules/features with 1-line description each]`,
      ``,
      `## Architecture Decisions`,
      `[Key architectural choices and WHY — monorepo vs multi-repo, API design, data model approach, etc.]`,
      ``,
      `## Development Guidelines`,
      `[Coding standards, naming conventions, testing requirements, commit conventions]`,
      ``,
      `## Key Constraints`,
      `[Budget range, timeline, compliance requirements, integrations]`,
      ``,
      `## Success Criteria`,
      `[Measurable acceptance criteria — what "done" looks like for this project]`,
    ].join("\n")

    const claudeMd = await callDeepSeek(apiKey, AI_SYSTEM, claudeMdPrompt, 5000)

    // ── 4. Generate SPECIFICATIONS.md ─────────────────────────────────────

    const specPrompt = [
      `Project: ${projectName}`,
      `Client: ${customerName}`,
      ``,
      `Requirements by section:`,
      reqContext,
      ``,
      `Proposal content:`,
      proposalText.slice(0, 3000),
      ``,
      `Generate a SPECIFICATIONS.md file with detailed technical specifications for each module.`,
      `This file is used by Claude Code to understand exactly what to build in each development session.`,
      ``,
      `Structure for EACH module/section:`,
      `## [Module Name]`,
      ``,
      `### Purpose`,
      `[What problem this module solves]`,
      ``,
      `### Functional Requirements`,
      `[Numbered list of specific features/behaviours — each must be testable]`,
      ``,
      `### Technical Approach`,
      `[How to implement it — data models, API design, key algorithms, integrations]`,
      ``,
      `### Deliverables`,
      `[What the client gets — screens, APIs, integrations, documentation]`,
      ``,
      `### Acceptance Criteria`,
      `[Checkboxes — [ ] criteria for UAT sign-off]`,
      ``,
      `Write all sections. Be specific and technical — this drives AI code generation.`,
    ].join("\n")

    const specsMd = await callDeepSeek(apiKey, AI_SYSTEM, specPrompt, 7000)

    // ── 5. Generate PROJECT_PLAN.md ────────────────────────────────────────

    const planPrompt = [
      `Project: ${projectName}`,
      `Client: ${customerName}`,
      ``,
      `Proposal content (contains project plan):`,
      proposalText.slice(0, 5000),
      ``,
      `Generate a PROJECT_PLAN.md with a Markdown-formatted project plan extracted and structured from the proposal.`,
      ``,
      `Structure:`,
      `# Project Plan — [Project Name]`,
      ``,
      `## Overview`,
      `| Field | Value |`,
      `|---|---|`,
      `| Client | [name] |`,
      `| Start | TBD |`,
      `| Duration | [X months] |`,
      `| Budget | [range] |`,
      `| Delivery | [Fixed-price / Phases] |`,
      ``,
      `## Phase Breakdown`,
      `For each phase:`,
      `### Phase [N]: [Name] ([duration])`,
      `**Scope:** [what's built]`,
      `**Deliverables:**`,
      `- [ ] [deliverable]`,
      `**Milestone:** [milestone name]`,
      `**Budget:** €[X]–€[Y]`,
      ``,
      `## Risks & Mitigations`,
      `| Risk | Likelihood | Mitigation |`,
      `|---|---|---|`,
      ``,
      `## Next Steps`,
      `- [ ] [action]`,
    ].join("\n")

    const planMd = await callDeepSeek(apiKey, AI_SYSTEM, planPrompt, 5000)

    // ── 6. Upload to Bunny CDN ─────────────────────────────────────────────

    const prefix = `cursor-specs/${survey.customerId}/${surveyId}`
    const now    = Date.now()

    const [claudeUrl, specsUrl, planUrl] = await Promise.all([
      bunnyUpload(`${prefix}/CLAUDE-${now}.md`,           Buffer.from(claudeMd),  "text/markdown"),
      bunnyUpload(`${prefix}/SPECIFICATIONS-${now}.md`,   Buffer.from(specsMd),   "text/markdown"),
      bunnyUpload(`${prefix}/PROJECT_PLAN-${now}.md`,     Buffer.from(planMd),    "text/markdown"),
    ])

    return NextResponse.json({
      files: [
        { name: "CLAUDE.md",           url: claudeUrl,  description: "Main project instructions for Claude Code / Cursor" },
        { name: "SPECIFICATIONS.md",   url: specsUrl,   description: "Detailed technical specifications per module" },
        { name: "PROJECT_PLAN.md",     url: planUrl,    description: "Phase plan, milestones, risks, next steps" },
      ],
    })
  } catch (e) {
    console.error("[cursor-export]", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
