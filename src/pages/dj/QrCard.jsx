import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Copy, Maximize2 } from 'lucide-react';
import { Button, Dialog } from '../../components/ui';

/** QR code for `text` as an inline SVG (one path, black on white, 4-module quiet zone). */
function QrSvg({ text, label }) {
  const { size, d } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let path = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (qr.isDark(y, x)) path += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
    return { size: n + 8, d: path };
  }, [text]);
  return (
    <svg className="dj-qr__svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

/** @param {{ notify: (text: string) => void }} props */
export default function QrCard({ notify }) {
  const [full, setFull] = useState(false);
  const url = `${window.location.origin}/request`;
  const label = `QR code for ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copied.');
    } catch {
      notify(`Couldn't copy. The link is ${url}`);
    }
  }

  return (
    <section className="dj-card dj-qr" aria-labelledby="dj-qr-title">
      <h2 id="dj-qr-title" className="dj-section-title">
        Request QR code
      </h2>
      <p className="dj-muted">Guests scan this to request a song.</p>
      <div className="dj-qr__frame">
        <QrSvg text={url} label={label} />
      </div>
      <p className="dj-qr__url">{url}</p>
      <div className="dj-qr__actions">
        <Button onClick={() => setFull(true)}>
          <Maximize2 size={18} aria-hidden="true" /> Full screen
        </Button>
        <Button variant="secondary" onClick={copy}>
          <Copy size={18} aria-hidden="true" /> Copy link
        </Button>
      </div>
      <Dialog open={full} onClose={() => setFull(false)} title="Scan to request a song" className="dj-portal dj-qr-dialog">
        <div className="dj-qr__big">
          <QrSvg text={url} label={label} />
        </div>
        <p className="dj-qr__url dj-qr__url--big">{url.replace(/^https?:\/\//, '')}</p>
      </Dialog>
    </section>
  );
}
