import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/components/ui/card"

interface Props {
	data: {
		imgsrc: string;
		title: string;
		content: string[];
	}[];
}

export function FeatureBlock({ data }: Props) {
	return (
		<>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
				{data.map((item, i) => {
					return (
						<Card className='shadow-md p-4 mb-4'>
							<div className="flex-col items-left sm:flex">
								<CardHeader className="flex flex-row items-center">
									<img src={item.imgsrc} alt={`${item.title} Logo`} className="rounded-sm w-16 h-16 mr-4" />
									<CardTitle className="pb-2">{item.title}</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="text-sm">
										{item.content.map((line, i) => {
											return(<>{line}<br /></>)
										})}
									</div>
								</CardContent>
							</div>
						</Card>
					);
				})}
			</div>
		</>
	)
}

export default FeatureBlock;