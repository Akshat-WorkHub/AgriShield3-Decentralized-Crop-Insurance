export default function StatusTag({ status }) {
  return <span className={`status-tag ${status}`}>{status}</span>;
}
