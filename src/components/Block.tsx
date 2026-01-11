import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"

interface Props {
  data: {
    title: string;
    description: string;
    content: string;
    footer: string;
  }[];
}

export function Block({ data }: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      {data.map((item, i) => {
        return (
          <div className="w-full sm:w-80">
            <Card>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p>{item.content}</p>
              </CardContent>
              <CardFooter>
                <p>{item.footer}</p>
              </CardFooter>
            </Card>
          </div>
        );
      })}
    </div>
  )
} 

export default Block;
