import {
  getRoom,
  updateRoom,
  readRoomBody,
  roomErrorResponse,
  roomResponse,
} from "@/lib/rooms";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const query = new URL(request.url).searchParams;
    return roomResponse(
      await getRoom(id, {
        token: query.get("token"),
        participantId: query.get("participantId"),
      }),
    );
  } catch (error) {
    return roomErrorResponse(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    return roomResponse(
      await updateRoom((await context.params).id, await readRoomBody(request)),
    );
  } catch (error) {
    return roomErrorResponse(error);
  }
}
