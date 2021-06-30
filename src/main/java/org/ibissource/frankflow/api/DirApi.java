package org.ibissource.frankflow.api;

import org.codehaus.jackson.jaxrs.JacksonJsonProvider;
import org.codehaus.jackson.map.ObjectMapper;
import org.ibissource.frankflow.model.DirModel;
import org.ibissource.frankflow.service.DirService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

@Path("/dir")
public class DirApi {

    @Autowired
    private DirService dirService;

    @GET
    @Path("/")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDirs() {
        return Response.status(Response.Status.OK).entity(dirService.getDirs()).build();
    }

    @GET
    @Path("/{path}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDirs(@PathParam("path") String path) {
        return Response.status(Response.Status.OK).entity("Hello World").build();
//        return Response.status(Response.Status.OK).entity(DirService.getDirs(path)).build();
    }

    @Bean
    public JacksonJsonProvider getJsonProvider() {
        return new JacksonJsonProvider();
    }
}
