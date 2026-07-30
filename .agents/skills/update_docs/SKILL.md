---
name: update_docs
description: "Automatically reviews recent codebase and schema changes and intelligently updates the core architectural documentation to reflect them."
---

# Update Documentation Skill

**CRITICAL RULE**: You must act as an aggressive, proactive documentation synchronizer. DO NOT wait for the user to invoke this skill. 
Whenever you complete a major feature, add a new database table, or change RLS policies, you MUST automatically run through this workflow before ending your turn. 

## Workflow

1. **Investigate Changes**:
   - Use your terminal tools (e.g., `git diff main`, `git log -n 5`) to identify what has changed in the codebase since the last major merge.
   - Pay special attention to changes in `supabase/migrations/` and `src/routes/__root.tsx` or core components.

2. **Analyze Impact**:
   - Read the existing documentation located in the `documentation/technical/` directory (`ARCHITECTURE.md` and `DATABASE_SCHEMA_AND_RLS.md`).
   - Determine if the recent code changes contradict or expand upon the current documentation (e.g., new database tables, changed RBAC rules, new global state variables).

3. **Update Documents**:
   - Use the `replace_file_content` tool to surgically update sections of the markdown files that are now out of date.
   - Do NOT rewrite the entire file unless necessary. Maintain the existing structure and tone.

4. **Report**:
   - Provide the user with a summary of exactly which sections of which documents were updated and why.
