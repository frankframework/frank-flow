package org.ibissource.frankflow.controller;

import org.ibissource.frankflow.model.DirModel;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dir")
public class DirController {
    private static final String BASEDIR = "C:\\Users\\Sergi\\Documents\\Stage\\projects\\franks\\frank2frank-flow\\src\\main\\configurations\\";

    @GetMapping
    public DirModel getDir(@RequestParam(value = "path", defaultValue = ".") String path) {
        return new DirModel(BASEDIR + path);
    }
}
