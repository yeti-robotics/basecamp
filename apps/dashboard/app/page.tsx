import { redirect } from 'next/navigation';

export default function HomePage() {
  // need to add bnside authg here jsut UI for now

  redirect('/auth');
}
