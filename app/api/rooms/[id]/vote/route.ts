import {
  voteRoom,
  readRoomBody,
  roomErrorResponse,
  roomResponse,
} from "@/lib/rooms";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    return roomResponse(
      await voteRoom((await context.params).id, await readRoomBody(request)),
    );
  } catch (error) {
    return roomErrorResponse(error);
  }
}
