from organizations.utils import get_user_organization


class DemoExpiryMiddleware:
    """Mark request when the user's demo org is expired (views may block; SPA shows CTA)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.demo_expired = False
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated and not user.is_superuser:
            membership = getattr(request, "organization_membership", None)
            if membership is None:
                membership = get_user_organization(user)
            org = membership.organization if membership else None
            if org is not None and org.is_demo_expired:
                request.demo_expired = True
                if not org.demo_locked:
                    org.demo_locked = True
                    org.save(update_fields=["demo_locked", "modified"])
        return self.get_response(request)


def _client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR")


def _guess_module(path: str) -> str:
    if "/instrumental" in path or "instrument-" in path or "fulfillment" in path:
        return "instrumental_control"
    if "/supply-kits" in path or "/medical" in path or "doctors" in path or "procedures" in path:
        return "medical_kits"
    if "/inventory" in path or "rfid" in path:
        return "inventory_realtime"
    if "/requisitions" in path or "/sales" in path or "/products" in path:
        return "logistics_requisitions"
    if "/platform" in path:
        return "platform"
    return ""


class UsageTelemetryMiddleware:
    """Record authenticated API/page usage for platform monitoring."""

    SKIP_PREFIXES = (
        "/static/",
        "/media/",
        "/admin/jsi18n/",
        "/jsreverse/",
        "/api/schema",
        "/favicon",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            self._record(request, response)
        except Exception:  # noqa: BLE001 — never break requests for telemetry
            pass
        return response

    def _record(self, request, response):
        path = request.path or ""
        if not path.startswith("/api/"):
            return
        if any(path.startswith(p) for p in self.SKIP_PREFIXES):
            return
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return

        membership = getattr(request, "organization_membership", None)
        if membership is None:
            membership = get_user_organization(user)
        if membership is None:
            return

        from organizations.models import UsageEvent

        ua = request.META.get("HTTP_USER_AGENT", "")[:512]
        UsageEvent.objects.create(
            organization=membership.organization,
            user=user,
            path=path[:512],
            method=request.method[:16],
            status_code=getattr(response, "status_code", None),
            ip_address=_client_ip(request),
            module_code=_guess_module(path),
            user_agent=ua,
        )
