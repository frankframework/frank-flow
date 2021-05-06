package org.ibissource.frankflow.controller;

import org.ibissource.frankflow.model.FileModel;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/file")
public class FileController {
    @GetMapping
    public FileModel getFile(@RequestParam(value = "path") String path) {
        return new FileModel(path);
    }

    @PostMapping
    public FileModel createFile(@RequestParam(value = "path") String path, @RequestBody(required = false) String content) {
        FileModel fileModel = new FileModel(path);
        fileModel.setContent(content);
        return fileModel;
    }

    @PutMapping
    public FileModel changeFile(@RequestParam(value = "path") String path, @RequestBody(required = false) String content) {
        FileModel fileModel = new FileModel(path);
        fileModel.setContent(content);
        return fileModel;
    }

//    @PutMapping("/file/rename")
//    public File renameFile(@RequestParam(value = "path") String path, @RequestBody(required = false) String name) {
//        File file = new File(path);
//        file.setName(name);
//        return file;
//    }

    @DeleteMapping
    public FileModel deleteFile(@RequestParam(value = "path") String path) {
        FileModel fileModel = new FileModel(path);
        fileModel.delete();
        return fileModel;
    }
}
