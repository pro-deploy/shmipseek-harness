/**
 * Customization settings pages, node half. The empty apply exists so the plugin
 * appears in the host cordis.yml / Loader; the browser half owns the pages through
 * exports["./client"]. The `user-system-prompt`, `user-mcp-servers`, and `user-skills`
 * namespaces the pages edit are registered by `dsh-user-customization`.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
