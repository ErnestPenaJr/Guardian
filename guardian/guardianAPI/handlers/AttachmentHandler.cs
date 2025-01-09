namespace Handlers
{
    public static class AttachmentHandler
    {
        public static RouteGroupBuilder MapAttachmentApi(this RouteGroupBuilder group)
        {
            group.MapGet("/attachment", () => "Hello World!");
            
            return group;
        }
    }
}