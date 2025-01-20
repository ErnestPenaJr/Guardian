

namespace Handlers
{
    public static class TemplateHandler
    {
        public static RouteGroupBuilder MapTemplatesApi(this RouteGroupBuilder group)
        {

            group.MapGet("/template/fields" , () => "Hello World!");
            
            //subject, financial, address, vehicle
            group.MapGet("/templates", () => "Hello World!");
            
            return group;
        }
    }
}