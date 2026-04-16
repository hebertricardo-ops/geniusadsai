import { useState, useEffect } from "react";
import { EDGE_FUNCTION_CODES } from "@/data/edge-function-codes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Database, Download, Code, Eye, EyeOff, Copy, Server,
  HardDrive, Key, FolderOpen, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";

interface TableInfo {
  name: string;
  row_count: number;
}

interface BucketInfo {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
}

interface ConnectionInfo {
  supabase_url: string;
  anon_key: string;
  project_ref: string;
}

const ADMIN_EMAIL = "hebertricardo@gmail.com";

const DB_FUNCTIONS = [
  { name: "enqueue_email", args: "queue_name text, payload jsonb", returns: "bigint" },
  { name: "read_email_batch", args: "queue_name text, batch_size integer, vt integer", returns: "TABLE(msg_id bigint, read_ct integer, message jsonb)" },
  { name: "delete_email", args: "queue_name text, message_id bigint", returns: "boolean" },
  { name: "move_to_dlq", args: "source_queue text, dlq_name text, message_id bigint, payload jsonb", returns: "bigint" },
  { name: "handle_new_user_credits", args: "", returns: "trigger" },
  { name: "update_updated_at_column", args: "", returns: "trigger" },
  { name: "handle_new_user", args: "", returns: "trigger" },
];

const SECRETS_LIST = [
  "FAL_KEY", "STRIPE_SECRET_KEY", "SUPABASE_ANON_KEY", "SUPABASE_DB_URL",
  "SUPABASE_PUBLISHABLE_KEY", "GOOGLE_SERVICE_ACCOUNT_JSON", "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY", "WEBHOOK_SECRET", "LOVABLE_API_KEY", "OPENAI_API_KEY"
];

const EDGE_FUNCTIONS = [
  "admin-dashboard", "check-user-exists", "create-checkout", "create-user-webhook",
  "delete-user-refund", "generate-carousel", "generate-copy", "generate-creative",
  "handle-payment-success", "process-email-queue", "update-user-credit"
];

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Record<string, any[]>>({});
  const [tableColumns, setTableColumns] = useState<Record<string, any[]>>({});
  const [showKeys, setShowKeys] = useState(false);
  const [storageFiles, setStorageFiles] = useState<Record<string, any[]>>({});
  const [loadingFnCode, setLoadingFnCode] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchMetadata();
  }, [user]);

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "get_metadata" },
      });
      if (error) throw error;
      setTables(data.tables || []);
      setBuckets(data.buckets || []);
      setConnection(data.connection || null);
    } catch (e: any) {
      toast({ title: "Erro ao carregar metadados", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName: string) => {
    if (tableData[tableName]) {
      setExpandedTable(expandedTable === tableName ? null : tableName);
      return;
    }
    try {
      const [dataRes, schemaRes] = await Promise.all([
        supabase.functions.invoke("admin-dashboard", {
          body: { action: "get_table_data", table_name: tableName },
        }),
        supabase.functions.invoke("admin-dashboard", {
          body: { action: "get_table_schema", table_name: tableName },
        }),
      ]);
      setTableData(prev => ({ ...prev, [tableName]: dataRes.data?.data || [] }));
      setTableColumns(prev => ({ ...prev, [tableName]: schemaRes.data?.columns || [] }));
      setExpandedTable(tableName);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const exportCSV = (tableName: string) => {
    const data = tableData[tableName];
    if (!data || data.length === 0) {
      toast({ title: "Sem dados", description: "Carregue os dados da tabela primeiro.", variant: "destructive" });
      return;
    }
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row =>
        headers.map(h => {
          const val = row[h];
          const str = typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
          return `"${str.replace(/"/g, '""')}"`;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableName}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado!", description: `${tableName}_export.csv` });
  };

  const generateSQL = (tableName: string) => {
    const columns = tableColumns[tableName];
    if (!columns || columns.length === 0) {
      toast({ title: "Sem schema", description: "Carregue os dados da tabela primeiro.", variant: "destructive" });
      return;
    }

    const colDefs = columns.map((col: any) => {
      let type = col.type || "text";
      if (type === "string") type = "text";
      if (type === "integer") type = "integer";
      let def = `  ${col.name} ${type}`;
      if (col.name === "id") def += " PRIMARY KEY";
      if (col.default) {
        const d = String(col.default);
        // Wrap non-numeric, non-function defaults in quotes
        const isFunc = d.includes("(") || d === "now()" || d === "gen_random_uuid()";
        const isNumeric = /^-?\d+(\.\d+)?$/.test(d);
        const isAlreadyQuoted = d.startsWith("'");
        if (!isFunc && !isNumeric && !isAlreadyQuoted) {
          def += ` DEFAULT '${d}'`;
        } else {
          def += ` DEFAULT ${d}`;
        }
      }
      return def;
    }).join(",\n");

    const sql = `-- Recreate table: ${tableName}\nCREATE TABLE IF NOT EXISTS public.${tableName} (\n${colDefs}\n);\n\nALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`;

    navigator.clipboard.writeText(sql);
    toast({ title: "SQL copiado!", description: `CREATE TABLE ${tableName} copiado para a área de transferência.` });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência.` });
  };

  const fetchStorageFiles = async (bucketName: string) => {
    if (storageFiles[bucketName]) return;
    try {
      const { data } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "get_storage_files", table_name: bucketName },
      });
      setStorageFiles(prev => ({ ...prev, [bucketName]: data?.files || [] }));
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const copyFunctionCode = (fnName: string) => {
    const code = EDGE_FUNCTION_CODES[fnName];
    if (code) {
      navigator.clipboard.writeText(code);
      toast({ title: "Código copiado!", description: `Código de ${fnName} copiado para a área de transferência.` });
    } else {
      toast({ title: "Erro", description: "Código não encontrado para esta função", variant: "destructive" });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (user.email !== ADMIN_EMAIL) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-normal">Painel de Administração</h1>
              <p className="text-muted-foreground text-sm">Gestão completa do backend</p>
            </div>
          </div>
          <Button onClick={fetchMetadata} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Tabs defaultValue="tables" className="space-y-4">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-1">
            <TabsTrigger value="tables" className="text-xs md:text-sm">
              <Server className="h-4 w-4 mr-1" /> Tabelas
            </TabsTrigger>
            <TabsTrigger value="functions" className="text-xs md:text-sm">
              <Code className="h-4 w-4 mr-1" /> Funções
            </TabsTrigger>
            <TabsTrigger value="storage" className="text-xs md:text-sm">
              <FolderOpen className="h-4 w-4 mr-1" /> Storage
            </TabsTrigger>
            <TabsTrigger value="secrets" className="text-xs md:text-sm">
              <Key className="h-4 w-4 mr-1" /> Secrets
            </TabsTrigger>
            <TabsTrigger value="connection" className="text-xs md:text-sm">
              <HardDrive className="h-4 w-4 mr-1" /> Conexão
            </TabsTrigger>
          </TabsList>

          {/* TABLES TAB */}
          <TabsContent value="tables" className="space-y-4">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground animate-pulse">Carregando tabelas...</div>
            ) : (
              tables.map((table) => (
                <Card key={table.name} className="overflow-hidden">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base font-semibold">{table.name}</CardTitle>
                        <Badge variant="secondary">{table.row_count} registros</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => fetchTableData(table.name)}>
                          {expandedTable === table.name ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                          {expandedTable === table.name ? "Fechar" : "Ver dados"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => exportCSV(table.name)}>
                          <Download className="h-4 w-4 mr-1" /> CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => generateSQL(table.name)}>
                          <Code className="h-4 w-4 mr-1" /> SQL
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {expandedTable === table.name && tableData[table.name] && (
                    <CardContent className="p-0 overflow-x-auto max-h-96">
                      {tableData[table.name].length === 0 ? (
                        <p className="text-center text-muted-foreground py-6">Tabela vazia</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {Object.keys(tableData[table.name][0]).map((col) => (
                                <TableHead key={col} className="whitespace-nowrap text-xs">{col}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tableData[table.name].slice(0, 50).map((row, i) => (
                              <TableRow key={i}>
                                {Object.values(row).map((val: any, j) => (
                                  <TableCell key={j} className="text-xs max-w-48 truncate">
                                    {typeof val === "object" ? JSON.stringify(val)?.substring(0, 80) : String(val ?? "—")}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                      {tableData[table.name].length > 50 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Exibindo 50 de {tableData[table.name].length} registros
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          {/* FUNCTIONS TAB */}
          <TabsContent value="functions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Funções do Banco de Dados</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Argumentos</TableHead>
                      <TableHead>Retorno</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DB_FUNCTIONS.map((fn) => (
                      <TableRow key={fn.name}>
                        <TableCell className="font-mono text-sm font-medium">{fn.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-64 truncate">{fn.args || "—"}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline">{fn.returns}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(`SELECT * FROM public.${fn.name}(${fn.args ? "..." : ""});`, fn.name)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Edge Functions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EDGE_FUNCTIONS.map((fn) => (
                      <TableRow key={fn}>
                        <TableCell className="font-mono text-sm font-medium">{fn}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          /functions/v1/{fn}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={loadingFnCode === fn}
                            onClick={() => copyFunctionCode(fn)}
                          >
                            {loadingFnCode === fn ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span className="ml-1 text-xs">Copiar código</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STORAGE TAB */}
          <TabsContent value="storage" className="space-y-4">
            {buckets.map((bucket) => (
              <Card key={bucket.id}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{bucket.name}</CardTitle>
                      <Badge variant={bucket.public ? "default" : "secondary"}>
                        {bucket.public ? "Público" : "Privado"}
                      </Badge>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => fetchStorageFiles(bucket.name)}>
                      <FolderOpen className="h-4 w-4 mr-1" /> Listar arquivos
                    </Button>
                  </div>
                </CardHeader>
                {storageFiles[bucket.name] && (
                  <CardContent className="pt-0">
                    {storageFiles[bucket.name].length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum arquivo encontrado</p>
                    ) : (
                      <div className="space-y-1">
                        {storageFiles[bucket.name].map((file: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                            <span className="font-mono">{file.name}</span>
                            <span className="text-muted-foreground">
                              {file.metadata?.size ? `${(file.metadata.size / 1024).toFixed(1)} KB` : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </TabsContent>

          {/* SECRETS TAB */}
          <TabsContent value="secrets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5" /> Secrets Configurados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {SECRETS_LIST.map((secret) => (
                    <div key={secret} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                      <span className="font-mono text-sm">{secret}</span>
                      <Badge variant="outline" className="text-green-600 border-green-300">Configurado</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONNECTION TAB */}
          <TabsContent value="connection" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <HardDrive className="h-5 w-5" /> Informações de Conexão
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setShowKeys(!showKeys)}>
                    {showKeys ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                    {showKeys ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {connection && (
                  <>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Supabase URL</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono break-all">
                            {showKeys ? connection.supabase_url : "••••••••••••••••"}
                          </code>
                          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(connection.supabase_url, "URL")}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Anon Key (Publishable)</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono break-all">
                            {showKeys ? connection.anon_key : "••••••••••••••••"}
                          </code>
                          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(connection.anon_key, "Anon Key")}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Project Ref</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono break-all">
                            {showKeys ? connection.project_ref : "••••••••••••••••"}
                          </code>
                          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(connection.project_ref, "Project Ref")}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">REST API URL</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono break-all">
                            {showKeys ? `${connection.supabase_url}/rest/v1/` : "••••••••••••••••"}
                          </code>
                          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(`${connection.supabase_url}/rest/v1/`, "REST URL")}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Auth URL</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono break-all">
                            {showKeys ? `${connection.supabase_url}/auth/v1/` : "••••••••••••••••"}
                          </code>
                          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(`${connection.supabase_url}/auth/v1/`, "Auth URL")}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">Storage URL</label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono break-all">
                            {showKeys ? `${connection.supabase_url}/storage/v1/` : "••••••••••••••••"}
                          </code>
                          <Button size="icon" variant="ghost" onClick={() => copyToClipboard(`${connection.supabase_url}/storage/v1/`, "Storage URL")}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
