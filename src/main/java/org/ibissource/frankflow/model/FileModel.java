package org.ibissource.frankflow.model;

public class FileModel {
    private String path;
    private String content;

    public FileModel(String path) {
        this.path = path;
    }

    public String getPath() {
        return path;
    }

    public String getContent() {
        return this.content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public void delete() {
        this.content = null;
    }

    public void setName(String name) {
        String[] path = this.path.split("/");
        path[path.length - 1] = name;
        this.path = String.join("/", path);
    }
}
