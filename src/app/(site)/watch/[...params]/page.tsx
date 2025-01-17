import { animeInfo, popular, watch, publicUrl } from "@/lib/consumet"
import Episodes from "@/components/episode/episodes"
import Details from "@/components/details"
import Sharethis from "@/components/sharethis"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getSession } from "../../../../lib/session"
import Server from "@/components/server"
import { createViewCounter, createWatchlist, increment } from "@/app/actions"
import { Suspense } from "react"
import VideoPlayer from "@/components/player/oplayer/ssr"

type Params = {
  params: {
    params: string[]
  }
}

export async function generateMetadata({
  params,
}: {
  params: {
    params: string[]
  }
}): Promise<Metadata | undefined> {
  const [animeId, episodeId] = params.params

  const response = await animeInfo(animeId)

  if (!response) {
    return
  }

  const title = response.title ?? response.otherName
  const description = response.description
  const imageUrl = response.image

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${publicUrl}/watch/${animeId}/${episodeId}`,
      images: [
        {
          url: `${imageUrl}`,
          width: 600,
          height: 400,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: `${imageUrl}`,
          width: 600,
          height: 400,
        },
      ],
    },
  }
}

export const dynamic = "force-dynamic"

export default async function Watch({ params: { params } }: Params) {
  const [animeId, episodeNumber] = params as string[]
  const session = await getSession()

  if (!animeId || !episodeNumber) notFound()

  const animeResponse = await animeInfo(animeId)

  if (!animeResponse) notFound()

  await createViewCounter({
    animeId,
    title: animeResponse.title ?? animeResponse.otherName,
    image: animeResponse.image,
  })

  const sourcesPromise = watch(`${animeId}-episode-${episodeNumber}`)

  const nextEpisode = (): string => {
    if (Number(episodeNumber) === animeResponse.episodes?.length)
      return episodeNumber

    const nextEpisodeNumber = animeResponse.episodes.findIndex(
      (episode) => episode.number === Number(episodeNumber)
    )

    return String(nextEpisodeNumber + 2)
  }

  const prevEpisode = (): string => {
    if (Number(episodeNumber) === 1) return episodeNumber

    const nextEpisodeNumber = animeResponse.episodes.findIndex(
      (episode) => episode.number === Number(episodeNumber)
    )

    return String(nextEpisodeNumber)
  }

  if (session) {
    await createWatchlist({
      animeId,
      episodeNumber,
      title: animeResponse.title ?? animeResponse.otherName,
      image: animeResponse.image,
      nextEpisode: nextEpisode(),
      prevEpisode: prevEpisode(),
    })
  }

  await increment(animeId)

  return (
    <div className="mt-5 flex-1">
      <Suspense fallback={<div>Loading...</div>}>
        <VideoPlayer
          animeId={animeId}
          nextEpisode={nextEpisode()}
          prevEpisode={prevEpisode()}
          sourcesPromise={sourcesPromise}
          episodeId={`${animeId}-episode-${episodeNumber}`}
          episodeNumber={episodeNumber}
        />
      </Suspense>
      {/* <VideoPlayer animeId={animeId} episodeNumber={episodeNumber} /> */}
      <Suspense>
        <Server
          episodeId={`${animeId}-episode-${episodeNumber}`}
          animeResult={animeResponse}
          episodes={animeResponse?.episodes}
          animeId={animeId}
          episodeNumber={episodeNumber}
        />
      </Suspense>
      {animeResponse ? (
        <>
          <Episodes
            animeId={animeId}
            fullEpisodes={animeResponse.episodes}
            episodeId={`${animeId}-episode-${episodeNumber}`}
          />
          <Details data={animeResponse} />
        </>
      ) : (
        <div>Loading Episodes</div>
      )}
      <Sharethis />
    </div>
  )
}
