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

            
            
            return group;
        }
    }
}