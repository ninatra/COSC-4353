import Icon from './Icon.jsx';

// Tinted square with the service's icon. size: 'sm' | 'lg' | undefined
export default function ServiceTile({ service, size }) {
  return (
    <span className={`tile ${size ? `tile-${size}` : ''} tint-${service.tint || 'blue'}`} aria-hidden="true">
      <Icon name={service.icon} />
    </span>
  );
}
