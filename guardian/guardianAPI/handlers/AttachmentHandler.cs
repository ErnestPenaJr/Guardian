namespace Handlers
{
    public static class AttachmentHandler
    {
        public static RouteGroupBuilder MapAttachmentApi(this RouteGroupBuilder group)
        {
            group.MapGet("/attachments/{id}", (Guid id) => 
            {
                return Results.Ok();
            });

            
            group.MapPost("/attachments", async (HttpRequest request) => 
            {
                if (!request.HasFormContentType)
                {
                    return Results.BadRequest("Invalid content type");
                }

                var form = await request.ReadFormAsync();
                var file = form.Files.GetFile("file");

                //TODO we must validate supported content types

                if (file == null || file.Length == 0)
                {
                    return Results.BadRequest("No file uploaded");
                }


                return Results.Ok();
            });

            group.MapDelete("/attachments/{id}", (Guid id) => 
            {
                //soft delete?
                return Results.Ok();
            });

            
            return group;
        }
    }
}