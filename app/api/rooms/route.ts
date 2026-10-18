import {
  createRoom,
  readRoomBody,
  roomErrorResponse,
  roomResponse,
} from "@/lib/rooms";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    return roomResponse(await createRoom(await readRoomBody(request)), 201);
  } catch (error) {
    return roomErrorResponse(error);
  }
}
