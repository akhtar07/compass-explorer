import React, { useState, useCallback } from 'react'
import { UploadCloud } from 'lucide-react'

export default function Upload() {
  const [img, setImg] = useState(null)
  const [name, setName] = useState('')

  const onFile = useCallback(f => {
    if (!f || !f.type.startsWith('image/')) return
    setName(f.name)
    const r = new FileReader()
    r.onload = e => setImg(e.target.result)
    r.readAsDataURL(f)
  }, [])

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div
        className="card border-dashed p-10 text-center cursor-pointer hover:border-sky-500"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}
        onClick={() => document.getElementById('fileinput').click()}>
        <UploadCloud className="mx-auto mb-2 text-sky-400" size={40} />
        <div className="text-slate-300">Drag &amp; drop a binary phase-diagram image, or click to browse</div>
        <div className="text-xs text-slate-500 mt-1">PNG / JPG — stays in your browser, nothing is uploaded to a server</div>
        <input id="fileinput" type="file" accept="image/*" className="hidden"
          onChange={e => onFile(e.target.files[0])} />
      </div>
      {img && (
        <div className="card glow p-4">
          <div className="text-sm text-slate-400 mb-2">{name}</div>
          <div className="bg-white rounded-lg p-2 flex justify-center">
            <img src={img} alt="uploaded phase diagram" className="max-h-[520px] object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
