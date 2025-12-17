import { useClientContext } from "../lib/clientContext.jsx";

export default function ClientPicker() {
  const { clients, currentClientId, setCurrentClientId } = useClientContext();
  if (!clients.length) return null;
  return (
    <select
      className="border rounded-md px-2 py-1"
      value={currentClientId || ""}
      onChange={(e) => setCurrentClientId(e.target.value || null)}
    >
      {clients.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}
