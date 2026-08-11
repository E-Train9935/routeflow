export type WorkerStatus =
  | "available"
  | "assigned"
  | "en_route"
  | "arrived"

export type TripSummary = {
  id: string

  customerName: string

  destination: string

  destinationLatitude:
    number | null

  destinationLongitude:
    number | null
}

export type WorkerLocation = {
  latitude: number
  longitude: number
  accuracyMeters: number | null
  updatedAt: string
}

export type WorkerCardData = {
  id: string
  name: string
  initials: string
  role: string
  status: WorkerStatus

  activeTrip?: TripSummary

  currentLocation?: WorkerLocation
}