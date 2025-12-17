import { useRef, useState } from 'react';

export default function CustomFilePicker({
  accept = '',
  onFileSelected,
  label = 'Drag file here or click to browse',
  className = '',
  inputRef: controlledInputRef,
}) {
  const internalInputRef = useRef(null);
  const inputRef = controlledInputRef || internalInputRef;
  const [hovered, setHovered] = useState(false);

  const handleInputChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (onFileSelected) onFileSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setHovered(false);
    const file = e.dataTransfer.files?.[0] || null;
    if (onFileSelected) onFileSelected(file);
  };

  return (
    <div
      className={`client-dash-file-picker ${hovered ? 'is-hovered' : ''} ${className || ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setHovered(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setHovered(false);
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        className="client-dash-file-hidden"
        type="file"
        accept={accept}
        onChange={handleInputChange}
        tabIndex={-1}
      />
      <span className="client-dash-file-picker-icon" aria-hidden="true">📄</span>
      <span className="client-dash-file-picker-label">{label}</span>
    </div>
  );
}
