// Lightweight skeleton screen used by route-level loading.jsx files.
// Server component (no "use client") — renders zero JS to the client.
//
// Variants:
//   - "form"     : prompt generators (header, form area, result strip)
//   - "list"     : page header + grid of cards (history / analytics / marketplace)
//   - "default"  : header only — generic minimal placeholder
//
// Animation comes from the global `.skeleton-shimmer` class in components.css.

function Bar({ w = "100%", h = 14, mt = 0, mb = 0, r = 6, style = {} }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width: w,
        height: h,
        marginTop: mt,
        marginBottom: mb,
        borderRadius: r,
        ...style,
      }}
    />
  );
}

function Card({ children, mt = 0 }) {
  return (
    <div
      style={{
        background: "var(--card-bg, #fff)",
        border: "1px solid var(--border, rgba(0,0,0,0.08))",
        borderRadius: 14,
        padding: 20,
        marginTop: mt,
      }}
    >
      {children}
    </div>
  );
}

function Header() {
  return (
    <>
      <Bar w="60%" h={28} r={8} />
      <Bar w="40%" h={14} mt={10} />
    </>
  );
}

function FormSkeleton() {
  return (
    <div style={{ padding: "32px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <Header />
      <Card mt={24}>
        <Bar w="30%" h={16} />
        <Bar w="100%" h={120} mt={12} r={10} />
        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Bar key={i} w={90} h={32} r={20} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Bar w={140} h={42} r={10} />
          <Bar w={140} h={42} r={10} />
        </div>
      </Card>
      <Card mt={20}>
        <Bar w="25%" h={16} />
        <Bar w="100%" h={80} mt={12} r={10} />
        <Bar w="100%" h={80} mt={12} r={10} />
      </Card>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div style={{ padding: "32px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <Header />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
          marginTop: 24,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <Bar w="55%" h={18} />
            <Bar w="100%" h={12} mt={12} />
            <Bar w="80%" h={12} mt={8} />
            <Bar w={110} h={28} r={8} mt={16} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function DefaultSkeleton() {
  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <Header />
      <Card mt={24}>
        <Bar w="100%" h={120} r={10} />
      </Card>
    </div>
  );
}

export default function RouteSkeleton({ variant = "default" }) {
  if (variant === "form") return <FormSkeleton />;
  if (variant === "list") return <ListSkeleton />;
  return <DefaultSkeleton />;
}
