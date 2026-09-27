import {
  ArrowLeft, ArrowUp, Bell, BellRing, Building2, Check, ChevronDown, ChevronUp, CircleAlert,
  CircleCheck, Clock, GraduationCap, History, House, IdCard, Info, Laptop, LayoutDashboard,
  LayoutGrid, ListOrdered, Lock, LockOpen, LogOut, MapPin, Moon, Pencil, Plus, Sun, Ticket,
  UserMinus, UserPlus, X,
} from 'lucide-react';

// Services store an icon name; this maps names to icons.
const ICONS = {
  'arrow-left': ArrowLeft, 'arrow-up': ArrowUp, bell: Bell, 'bell-ring': BellRing, 'building-2': Building2,
  check: Check, 'chevron-down': ChevronDown, 'chevron-up': ChevronUp, 'circle-alert': CircleAlert,
  'circle-check': CircleCheck, clock: Clock, 'graduation-cap': GraduationCap, history: History, house: House,
  'id-card': IdCard, info: Info, laptop: Laptop, 'layout-dashboard': LayoutDashboard, 'layout-grid': LayoutGrid,
  'list-ordered': ListOrdered, lock: Lock, 'lock-open': LockOpen, 'log-out': LogOut, 'map-pin': MapPin,
  moon: Moon, pencil: Pencil, plus: Plus, sun: Sun, ticket: Ticket, 'user-minus': UserMinus,
  'user-plus': UserPlus, x: X,
};

export default function Icon({ name, className }) {
  const Component = ICONS[name] ?? Building2;
  return <Component className={`lucide ${className ?? ''}`} strokeWidth={1.9} aria-hidden="true" />;
}
