## 2025-03-30 - Unauthenticated IDOR on Async Job Status Polling
**Vulnerability:** Missing authentication and user ownership checks on `GET /api/generate/status/{task_id}` allowed unauthenticated users or unauthorized third parties to query background job status and extract generated resume/ATS data.
**Learning:** Background task status dictionaries (`job_status`) were created without storing user context (`user_id`), causing the status polling endpoint to lack authorization checks.
**Prevention:** Always record owner `user_id` when initializing job/task metadata dicts and enforce `Depends(get_current_user)` + ownership validation on all task status polling endpoints.
