import EngineerRequestDetail from '@/views/maintenance/engineer/requests/EngineerRequestDetail'

type Props = {
  params: Promise<{ id: string; lang: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params

  return <EngineerRequestDetail requestId={Number(id)} />
}
