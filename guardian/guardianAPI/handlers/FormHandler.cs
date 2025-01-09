

namespace Handlers
{
    public static class FormHandler
    {
        public static RouteGroupBuilder MapFormApi(this RouteGroupBuilder group)
        {
            group.MapGet("/form", () => "Hello World!");
            
            return group;
        }
    }
}