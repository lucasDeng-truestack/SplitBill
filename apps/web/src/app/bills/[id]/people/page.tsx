import { redirect } from "next/navigation";

export default async function PeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/bills/${id}/collect`);
}
