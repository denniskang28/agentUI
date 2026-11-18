import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

/** HTTP client of the Host contract; this is NOT a Java MCP Gateway implementation. */
public final class McpHostExample {
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private final String base;
  private String token;
  McpHostExample(String base) { this.base = base; }
  String request(String method, String path, String body) throws Exception {
    var request = HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofSeconds(20));
    if (token != null) request.header("x-mcp-owner", token);
    if (body != null) request.header("Content-Type", "application/json");
    request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
    var response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 400) throw new IllegalStateException(response.statusCode()+": "+response.body());
    return response.body();
  }
  JsonObject object(String method, String path, String body) throws Exception {
    return JsonParser.parseString(request(method,path,body)).getAsJsonObject();
  }
  public static void main(String[] args) throws Exception {
    var host = new McpHostExample(args.length > 0 ? args[0] : "http://127.0.0.1:3001/api/v1/mcp");
    String serverId = args.length > 1 ? args[1] : "expense-demo";
    String tool = args.length > 2 ? args[2] : "expense_dashboard";
    System.out.println("servers: "+host.request("GET","/servers",null));
    var selected = new JsonObject(); selected.addProperty("serverId",serverId);
    var connection=host.object("POST","/connections",selected.toString());
    host.token=connection.get("ownerToken").getAsString();
    String path="/connections/"+connection.get("id").getAsString();
    try {
      var create=new JsonObject();create.addProperty("runId",UUID.randomUUID().toString());
      create.addProperty("requestId",UUID.randomUUID().toString());create.addProperty("tool",tool);
      create.add("arguments",new JsonObject());
      var app=host.object("POST",path+"/apps",create.toString());
      String instance=path+"/apps/"+app.get("id").getAsString();
      for(int count=0;app.get("status").getAsString().equals("running") && count<100;count++){
        Thread.sleep(100);app=host.object("GET",instance,null);
      }
      if(!app.get("status").getAsString().equals("complete"))throw new IllegalStateException("Tool did not complete: "+app.get("status"));
      System.out.println("result: "+app.get("result"));
      System.out.println("events: "+host.request("GET",instance+"/events?after=0",null));
      // Return app.id plus this user's scoped capability to React. Never return Server credentials.
      // React uses McpAppView/httpTransport; do not call create again to mount this result.
      System.out.println("React appId: "+app.get("id").getAsString());
      host.request("DELETE",instance,null);
      System.out.println("instance cleaned up");
    } finally {host.request("DELETE",path,null);System.out.println("connection cleaned up");}
  }
}
