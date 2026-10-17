export default function Card({ as: Tag = "div", raised = false, className = "", children, ...props }) {
  const classes = ["card", raised && "card-raised", className].filter(Boolean).join(" ");
  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}
