import { redirect } from 'next/navigation';

/** Tables are set up in the kitchen now ("Set the table"); old links land there. */
export default function CreatePage() {
  redirect('/');
}
