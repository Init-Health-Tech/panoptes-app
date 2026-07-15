import { REQUISITION_STATUS_LABELS } from '@/js/types/logistics';

type ValeType = 'salida' | 'entrada';

type RequisitionLineLike = {
  product_sku?: string | null;
  product_name?: string | null;
  quantity?: number | null;
};

type RequisitionLike = {
  id: number;
  origin?: string | null;
  destination?: string | null;
  status?: string | null;
  requested_at?: string | null;
  lines?: RequisitionLineLike[] | null;
};

const VALE_LABELS: Record<ValeType, string> = {
  salida: 'Vale de salida',
  entrada: 'Vale de entrada',
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value?: string | null): string {
  if (!value) return new Date().toLocaleString('es-MX');
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('es-MX');
}

function buildValeHtml(req: RequisitionLike, type: ValeType): string {
  const title = VALE_LABELS[type];
  const folio = `REQ-${String(req.id).padStart(5, '0')}`;
  const statusLabel =
    REQUISITION_STATUS_LABELS[(req.status ?? '') as keyof typeof REQUISITION_STATUS_LABELS] ??
    req.status ??
    '—';
  const lines = req.lines ?? [];
  const totalUnits = lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);

  const rows =
    lines.length > 0
      ? lines
          .map(
            (line, index) => `
        <tr>
          <td class="num">${index + 1}</td>
          <td class="mono">${escapeHtml(line.product_sku ?? '—')}</td>
          <td>${escapeHtml(line.product_name ?? '—')}</td>
          <td class="num">${escapeHtml(line.quantity ?? 0)}</td>
        </tr>`,
          )
          .join('')
      : `<tr><td colspan="4" class="empty">Sin productos en la requisición</td></tr>`;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — ${escapeHtml(folio)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1a1c1e;
      margin: 0;
      padding: 32px;
      background: #f4f5f7;
    }
    .sheet {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      padding: 40px 44px;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
    }
    .toolbar {
      max-width: 800px;
      margin: 0 auto 16px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      cursor: pointer;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      background: #2563eb;
      color: #fff;
    }
    header.doc {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e4e8;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .brand { font-size: 20px; font-weight: 800; letter-spacing: .5px; }
    .brand span { color: #2563eb; }
    .doc-type {
      text-transform: uppercase;
      font-size: 13px;
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 1px;
      text-align: right;
    }
    .doc-type strong { display: block; font-size: 22px; color: #111827; letter-spacing: 0; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .box { border: 1px solid #e2e4e8; border-radius: 10px; padding: 14px 16px; }
    .box .label { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; margin-bottom: 4px; }
    .box .value { font-size: 16px; font-weight: 600; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; padding: 10px 12px; border-bottom: 2px solid #e2e4e8; }
    td { padding: 10px 12px; border-bottom: 1px solid #eef0f3; font-size: 14px; }
    td.num, th.num { text-align: right; width: 90px; }
    td.mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
    td.empty { text-align: center; color: #9ca3af; padding: 24px; }
    tfoot td { font-weight: 700; border-top: 2px solid #e2e4e8; border-bottom: none; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 56px; }
    .sign { text-align: center; }
    .sign .line { border-top: 1px solid #9ca3af; padding-top: 8px; font-size: 12px; color: #6b7280; }
    footer.doc { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { box-shadow: none; border-radius: 0; max-width: none; padding: 24px; }
      .toolbar { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
  </div>
  <div class="sheet">
    <header class="doc">
      <div>
        <div class="brand">Pan<span>optes</span></div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">Control de inventario y logística</div>
      </div>
      <div class="doc-type">
        ${escapeHtml(type === 'salida' ? 'Documento de' : 'Documento de')}
        <strong>${escapeHtml(title)}</strong>
        Folio ${escapeHtml(folio)}
      </div>
    </header>

    <div class="meta">
      <div class="box">
        <div class="label">Origen</div>
        <div class="value">${escapeHtml(req.origin ?? '—')}</div>
      </div>
      <div class="box">
        <div class="label">Destino</div>
        <div class="value">${escapeHtml(req.destination ?? '—')}</div>
      </div>
      <div class="box">
        <div class="label">Fecha</div>
        <div class="value">${escapeHtml(formatDate(req.requested_at))}</div>
      </div>
      <div class="box">
        <div class="label">Estado</div>
        <div class="value"><span class="badge">${escapeHtml(statusLabel)}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>SKU</th>
          <th>Producto</th>
          <th class="num">Cantidad</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3">Total de piezas</td>
          <td class="num">${escapeHtml(totalUnits)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="signatures">
      <div class="sign"><div class="line">Entrega (nombre y firma)</div></div>
      <div class="sign"><div class="line">Recibe (nombre y firma)</div></div>
    </div>

    <footer class="doc">
      Documento generado automáticamente por Panoptes — ejemplo de vale de ${escapeHtml(type)}.
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Abre una nueva ventana con un vale imprimible (salida/entrada) de la
 * requisición, listo para "Imprimir / Guardar como PDF". No requiere backend:
 * usa los datos ya cargados de la requisición.
 */
export function openRequisitionVale(req: RequisitionLike, type: ValeType): void {
  const win = window.open('', '_blank');
  if (!win) {
    window.alert('Permite las ventanas emergentes para generar el documento PDF.');
    return;
  }
  win.document.open();
  win.document.write(buildValeHtml(req, type));
  win.document.close();
}
