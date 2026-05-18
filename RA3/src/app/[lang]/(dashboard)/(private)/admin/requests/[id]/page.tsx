import AdminRequestDetail from '@/views/maintenance/admin/requests/AdminRequestDetail'

type Props = {
  params: Promise<{ id: string; lang: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params

  return <AdminRequestDetail requestId={Number(id)} />
}
