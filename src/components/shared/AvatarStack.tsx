interface AvatarStackProps {
  count?: number;
}

export function AvatarStack({ count = 3 }: AvatarStackProps) {
  return (
    <div className="avatar-stack" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="avatar avatar--tiny">
          {String.fromCharCode(65 + index)}
        </div>
      ))}
    </div>
  );
}