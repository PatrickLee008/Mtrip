<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\MerchantDocumentService;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Support\Result;

class MerchantDocumentController extends AbstractController
{
    #[\Hyperf\Di\Annotation\Inject]
    protected \Hyperf\HttpServer\Contract\ResponseInterface $response;
    #[Permission('merchant:document:replace')]
    public function replace(): array
    {
        return Result::success((new MerchantDocumentService())->replace($this->requireId('docId'), $this->request->all(), $this->request->file('file')));
    }

    #[Permission('merchant:document:verify')]
    public function review(): array
    {
        return Result::success((new MerchantDocumentService())->review($this->requireId('docId'), $this->request->all()));
    }

    #[Permission('merchant:document:verify')]
    public function resubmit(): array
    {
        return Result::success((new MerchantDocumentService())->resubmit($this->requireId('docId'), $this->request->all()));
    }

    // Service authorizes independent M12 download, or module11 draft/verification access.
    public function download(): \Psr\Http\Message\ResponseInterface
    {
        $data = (new MerchantDocumentService())->download($this->requireId('docId'), $this->intInput('revisionId') ?: null);
        return $this->response->json(Result::success($data))->withHeader('Cache-Control', 'no-store, private')
            ->withHeader('Pragma', 'no-cache')->withHeader('X-Content-Type-Options', 'nosniff');
    }

    #[Permission('merchant:doc:list')]
    public function history(): array
    {
        $service = new MerchantDocumentService();
        $doc = $service->document($this->requireId('docId'));
        $history = Db::table('merchant_document_event')->where('doc_id', $doc['id'])->orderByDesc('id')->get()->map(static fn ($r) => (array) $r)->all();
        $revisions = Db::table('merchant_verify_document_revision')->where('doc_id', $doc['id'])->orderByDesc('id')->get()->map(static function ($r) {
            $row = (array) $r;
            $row['has_file'] = $row['file_url'] !== '';
            unset($row['file_url']);
            return $row;
        })->all();
        $doc['merchant_name'] = (string) Db::table('merchant_info')->where('id', $doc['merchant_id'])->value('merchant_name');
        $doc['has_file'] = $doc['file_url'] !== '';
        unset($doc['file_url']);
        return Result::success(['document' => $doc, 'history' => $history, 'revisions' => $revisions]);
    }
}
