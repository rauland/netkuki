import {
	Card,
	CardContent
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
			{data.map((item, i) => {
				return (
					<Card className='shadow-md p-4 mb-4'>
						<div className="flex-row items-center sm:flex">
							<img src={item.imgsrc} alt={`${item.title} Logo`} className="rounded-sm w-16 h-16 mr-4" />
							<h3 className="text-lg font-semibold">{item.title}</h3>
							<CardContent className="p-0 sm:p-4">
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
		</>
	)
}

export default FeatureBlock;