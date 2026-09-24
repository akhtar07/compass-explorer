import React, { useState, useCallback } from 'react'
import { UploadCloud, ImageIcon, X, ShieldCheck } from 'lucide-react'

// Local-only phase-diagram viewer: the file never leaves the browser.
export default function Upload() {
  const [img, setImg] = useState(null)
  const [name, setName] = useState('')
  const [drag, setDrag] = useState(false)

  const onFile = useCallback(f => {
    if (!f || !f.type.startsWith('image/')) return
    setName(f.name)
    const r = new FileReader()
    r.onload = e => setImg(e.target.result)
    r.readAsDataURL(f)
  }, [])

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="card p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[.12em] text-[var(--dim)]"><ImageIcon size={13} className="text-[var(--accent)]" /> Phase-diagram viewer</div>
        <p className="text-sm text-[var(--dim)] leading-relaxed">Drop a binary phase-diagram image to view it side by side with the explorer (for example an assessed diagram you want to check against a system page).</p>
      </div>
      <div
        className="card border-dashed p-10 text-center cursor-pointer transition"
        style={drag ? { borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)' } : {}}
        onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]) }}
        onClick={() => document.getElementById('fileinput').click()}>
        <span className="w-14 h-14 rounded-2xl chip-grad grad-border mx-auto mb-3 flex items-center justify-center"><UploadCloud className="text-[var(--accent)]" size={28} /></span>
        <div className="text-[var(--text)] font-medium">Drag &amp; drop a binary phase-diagram image, or click to browse</div>
        <div className="text-xs text-[var(--dim)] mt-1 flex items-center justify-center gap-1"><ShieldCheck size={12} /> PNG / JPG — stays in your browser, nothing is uploaded to a server</div>
        <input id="fileinput" type="file" accept="image/*" className="hidden"
          onChange={e => onFile(e.target.files[0])} />
      </div>
      {img && (
        <div className="card glow p-4 fade-up">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-[var(--dim)] mono truncate">{name}</span>
            <button onClick={() => { setImg(null); setName('') }} className="ml-auto pill hover:border-[var(--border-strong)]"><X size={12} /> clear</button>
          </div>
          <div className="bg-white rounded-lg p-2 flex justify-center">
            <img src={img} alt="uploaded phase diagram" className="max-h-[520px] object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
